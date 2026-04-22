package config

import (
	"os"
	"strconv"
)

// Config representa la configuracion del csvprocessor.
type Config struct {
	GRPCAddress    string
	TimeoutSeconds int

	InputDir     string // incoming_logs/
	RawBackupDir string // raw_backup/
	FailedDir    string // failed_logs/

	NumWorkers       int // Goroutines procesando en paralelo (default 4)
	WatchIntervalMs  int // Cada cuantos ms revisar incoming_logs (default 200)
	RetryIntervalSec int // Cada cuantos segundos reintentar failed_logs (default 30)
	StatsIntervalSec int // Cada cuantos segundos imprimir estadisticas (default 10)

	// Alertas: comunicacion con main-api cuando un archivo falla todos sus reintentos.
	MainAPIURL     string // URL base de main-api (ej: http://localhost:3000)
	InternalAPIKey string // Clave secreta compartida entre servicios internos
}

// Load construye la configuracion leyendo variables de entorno.
// Si alguna no existe, se usa un valor por defecto.
func Load() Config {
	return Config{
		GRPCAddress:    getEnv("GRPC_ADDRESS", "localhost:50051"),
		TimeoutSeconds: getEnvInt("TIMEOUT_SECONDS", 10),

		InputDir:     getEnv("INPUT_DIR", "data/incoming_logs"),
		RawBackupDir: getEnv("RAW_BACKUP_DIR", "data/raw_backup"),
		FailedDir:    getEnv("FAILED_DIR", "data/failed_logs"),

		NumWorkers:       getEnvInt("NUM_WORKERS", 4),
		WatchIntervalMs:  getEnvInt("WATCH_INTERVAL_MS", 200),
		RetryIntervalSec: getEnvInt("RETRY_INTERVAL_SEC", 30),
		StatsIntervalSec: getEnvInt("STATS_INTERVAL_SEC", 10),

		MainAPIURL:     getEnv("MAIN_API_URL", "http://localhost:3000"),
		InternalAPIKey: getEnv("INTERNAL_API_KEY", ""),
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getEnvInt(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}
