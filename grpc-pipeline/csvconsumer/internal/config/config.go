package config

import "os"

// Config representa la configuración del servicio csvconsumer.
// Aquí centralizamos los valores que vienen desde variables de entorno.
type Config struct {
	GRPCPort   string // Puerto en el que escuchará el servidor gRPC.
	DBHost     string // Host de PostgreSQL.
	DBPort     string // Puerto de PostgreSQL.
	DBName     string // Nombre de la base de datos.
	DBUser     string // Usuario de PostgreSQL.
	DBPassword string // Contraseña de PostgreSQL.
}

// Load construye la configuración leyendo variables de entorno.
// Si alguna no existe, se usa un valor por defecto.
func Load() Config {
	return Config{
		GRPCPort:   getEnv("GRPC_PORT", "50051"),
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5433"),
		DBName:     getEnv("DB_NAME", "db_infra"),
		DBUser:     getEnv("DB_USER", "admin_infra"),
		DBPassword: getEnv("DB_PASSWORD", "Infra2026Secure!"),
	}
}

// getEnv devuelve el valor de una variable de entorno.
// Si la variable no existe o viene vacía, devuelve el valor por defecto.
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
