package main

import (
	"context"
	"fmt"
	"log"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"github.com/joho/godotenv"

	"grpc-pipeline/csvprocessor/internal/alertclient"
	"grpc-pipeline/csvprocessor/internal/config"
	"grpc-pipeline/csvprocessor/internal/csvreader"
	"grpc-pipeline/csvprocessor/internal/filemanager"
	"grpc-pipeline/csvprocessor/internal/grpcclient"
	"grpc-pipeline/csvprocessor/internal/parser"
	"grpc-pipeline/csvprocessor/internal/sender"
	pb "grpc-pipeline/proto"
)

// ── Contadores globales (thread-safe) ────────────────────────────
var (
	totalProcessed atomic.Int64
	totalInserted  atomic.Int64
	totalFailed    atomic.Int64
	totalRetryOk   atomic.Int64
)

func main() {
	_ = godotenv.Load("csvprocessor/.env")
	_ = godotenv.Load(".env")

	cfg := config.Load()

	if err := filemanager.EnsureDirectories(cfg.InputDir, cfg.RawBackupDir, cfg.FailedDir); err != nil {
		log.Fatalf("❌ error preparando directorios: %v", err)
	}

	// Conecta al servidor gRPC
	conn, err := grpcclient.NewConnection(cfg.GRPCAddress)
	if err != nil {
		log.Fatalf("❌ no se pudo conectar al servidor gRPC [%s]: %v", cfg.GRPCAddress, err)
	}
	defer conn.Close()
	client := pb.NewLogIngestionClient(conn)

	// Crea el cliente de alertas para notificar a main-api cuando un archivo falla.
	// Si INTERNAL_API_KEY está vacío en el .env, las alertas se loguearán pero no
	// llegarán a main-api (útil para entornos de desarrollo sin main-api corriendo).
	alerts := alertclient.New(cfg.MainAPIURL, cfg.InternalAPIKey)

	// Canal de archivos pendientes — buffer generoso para no bloquear el watcher
	fileChan := make(chan string, 500)

	// Mapa de archivos en proceso — evita que el watcher encole el mismo archivo dos veces
	var inProcess sync.Map

	fmt.Printf("🚀 csvprocessor iniciado | workers: %d | watch: %dms | retry: %ds\n",
		cfg.NumWorkers, cfg.WatchIntervalMs, cfg.RetryIntervalSec)
	fmt.Println("─────────────────────────────────────────────────────")

	// ── Workers en paralelo ──────────────────────────────────────
	for i := 0; i < cfg.NumWorkers; i++ {
		go func(workerID int) {
			for filePath := range fileChan {
				// Pasamos el cliente de alertas a processFile para que
				// pueda notificar si el archivo agota todos sus reintentos.
				processFile(filePath, cfg, client, &inProcess, alerts)
				inProcess.Delete(filePath)
			}
		}(i)
	}

	// ── Watcher — vigila incoming_logs cada N ms ──────────────────
	go func() {
		for {
			files, err := filemanager.ListInputFiles(cfg.InputDir)
			if err == nil {
				for _, f := range files {
					// Solo encolar si no está ya siendo procesado
					if _, exists := inProcess.LoadOrStore(f, true); !exists {
						fileChan <- f
					}
				}
			}
			time.Sleep(time.Duration(cfg.WatchIntervalMs) * time.Millisecond)
		}
	}()

	// ── Retry — reintenta failed_logs cada N segundos ─────────────
	go func() {
		for {
			time.Sleep(time.Duration(cfg.RetryIntervalSec) * time.Second)

			files, err := filemanager.ListInputFiles(cfg.FailedDir)
			if err != nil || len(files) == 0 {
				continue
			}

			fmt.Printf("🔄 reintentando %d archivo(s) de failed_logs...\n", len(files))
			for _, f := range files {
				if _, exists := inProcess.LoadOrStore(f, true); !exists {
					fileChan <- f
				}
			}
		}
	}()

	// ── Stats — imprime estadísticas cada N segundos ──────────────
	go func() {
		for {
			time.Sleep(time.Duration(cfg.StatsIntervalSec) * time.Second)
			pending, _ := filemanager.ListInputFiles(cfg.InputDir)
			failed, _ := filemanager.ListInputFiles(cfg.FailedDir)
			fmt.Printf("📊 stats | procesados: %d | insertados: %d | fallidos: %d | recuperados: %d | pendientes: %d | en failed: %d\n",
				totalProcessed.Load(),
				totalInserted.Load(),
				totalFailed.Load(),
				totalRetryOk.Load(),
				len(pending),
				len(failed),
			)
		}
	}()

	// Bloquea indefinidamente — el programa corre hasta que lo detengas con Ctrl+C
	select {}
}

// processFile ejecuta el pipeline completo para un archivo con hasta 3 intentos.
// Si agota todos los reintentos, envía una alerta a main-api con el detalle del error.
func processFile(filePath string, cfg config.Config, client pb.LogIngestionClient, inProcess *sync.Map, alerts *alertclient.Client) {
	fileName := filepath.Base(filePath)
	isRetry := filepath.Dir(filePath) == cfg.FailedDir
	maxTries := 3

	for attempt := 1; attempt <= maxTries; attempt++ {
		ok, inserted, dur, errMsg := runPipeline(filePath, cfg, client)

		if ok {
			totalProcessed.Add(1)
			totalInserted.Add(int64(inserted))
			if isRetry {
				totalRetryOk.Add(1)
				filemanager.DeleteFile(filePath)
				fmt.Printf("✅ [retry] %-25s | attempt %d/%d | records: %d | %dms\n",
					fileName, attempt, maxTries, inserted, dur.Milliseconds())
			} else {
				fmt.Printf("✅ %-25s | attempt %d/%d | records: %d | %dms\n",
					fileName, attempt, maxTries, inserted, dur.Milliseconds())
			}
			return
		}

		// Falló
		if attempt < maxTries {
			fmt.Printf("⚠️  %-25s | attempt %d/%d | %s | reintentando...\n",
				fileName, attempt, maxTries, errMsg)
			time.Sleep(200 * time.Millisecond)
		} else {
			// Agotó todos los reintentos — registrar como fallido y alertar.
			totalFailed.Add(1)
			fmt.Printf("❌ %-25s | attempt %d/%d | %s\n",
				fileName, attempt, maxTries, errMsg)

			// Si no venía de failed_logs, moverlo ahí para reintentar más tarde.
			if !isRetry {
				if err := filemanager.MoveToFailed(filePath, cfg.FailedDir); err != nil {
					log.Printf("⚠️  no se pudo mover [%s] a failed_logs: %v", fileName, err)
				}
			}

			// Notificar a main-api para que despache un correo a los administradores.
			// Se ejecuta en goroutine para no bloquear el worker.
			go alerts.EnviarAlerta("error_archivo", map[string]interface{}{
				"archivo":  fileName,           // Nombre del archivo que falló.
				"error":    errMsg,             // Descripción del último error.
				"intentos": maxTries,           // Total de intentos realizados.
				"carpeta":  "failed_logs",      // Dónde quedó el archivo.
			})
		}
	}
}

// runPipeline ejecuta los 4 pasos del pipeline para un archivo.
func runPipeline(filePath string, cfg config.Config, client pb.LogIngestionClient) (bool, int, time.Duration, string) {
	start := time.Now()
	fileName := filepath.Base(filePath)

	// 1. Leer
	result, err := csvreader.Read(filePath)
	if err != nil {
		return false, 0, 0, fmt.Sprintf("lectura: %v", err)
	}

	// 2. Backup
	if err := filemanager.CopyToBackupBySerial(filePath, cfg.RawBackupDir, result.IDSerial); err != nil {
		return false, 0, 0, fmt.Sprintf("backup: %v", err)
	}

	// 3. Transformar
	records, err := parser.BuildTelemetryRecords(result.Rows)
	if err != nil {
		return false, 0, 0, fmt.Sprintf("parse: %v", err)
	}

	// 4. Enviar por gRPC
	ctx, cancel := context.WithTimeout(
		context.Background(),
		time.Duration(cfg.TimeoutSeconds)*time.Second,
	)
	resp, err := sender.SendRecords(ctx, client, fileName, records)
	cancel()

	if err != nil {
		return false, 0, 0, fmt.Sprintf("gRPC: %v", err)
	}
	if !resp.Ok {
		return false, 0, 0, fmt.Sprintf("consumer: %s", resp.Message)
	}

	filemanager.DeleteFile(filePath)
	return true, int(resp.Inserted), time.Since(start), ""
}
