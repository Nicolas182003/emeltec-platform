package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	pb "grpc-pipeline/proto"
)

// LogRecordRepository encapsula el acceso a la tabla equipo.
type LogRecordRepository struct {
	db *sql.DB
}

// NewLogRecordRepository crea una nueva instancia del repositorio.
func NewLogRecordRepository(database *sql.DB) *LogRecordRepository {
	return &LogRecordRepository{db: database}
}

// InsertBatch inserta todos los registros en un solo query SQL (batch INSERT).
// Mucho más rápido que N INSERTs individuales.
func (r *LogRecordRepository) InsertBatch(ctx context.Context, records []*pb.TelemetryRecord) (int, int, error) {
	if len(records) == 0 {
		return 0, 0, nil
	}

	// Construye placeholders: ($1,$2,$3,$4), ($5,$6,$7,$8), ...
	placeholders := make([]string, 0, len(records))
	args := make([]interface{}, 0, len(records)*4)

	for i, rec := range records {
		base := i * 4
		placeholders = append(placeholders,
			fmt.Sprintf("(($%d || ' ' || $%d)::timestamptz AT TIME ZONE 'UTC', $%d, $%d::jsonb)",
				base+1, base+2, base+3, base+4),
		)
		args = append(args, rec.Fecha, rec.Hora, rec.IdSerial, rec.Data)
	}

	query := fmt.Sprintf(
		`INSERT INTO equipo (time, id_serial, data) VALUES %s`,
		strings.Join(placeholders, ", "),
	)

	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, 0, err
	}

	inserted, _ := result.RowsAffected()
	return int(inserted), 0, nil
}
