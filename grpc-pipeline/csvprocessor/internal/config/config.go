package config

import (
	"os"
	"strconv"
)

// Config representa la configuración del csvprocessor.
type Config struct {
	GRPCAddress    string
	TimeoutSeconds int

	InputDir     string // incoming_logs/
	RawBackupDir string // raw_backup/
	FailedDir    string // failed_logs/

	NumWorkers      int // Goroutines procesando en paralelo (default 4)
	WatchIntervalMs int // Cada cuántos ms revisar incoming_logs (default 200)
	RetryIntervalSec int // Cada cuántos segundos reintentar failed_logs (default 30)
	StatsIntervalSec int // Cada cuántos segundos imprimir estadísticas (default 10)
}

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
