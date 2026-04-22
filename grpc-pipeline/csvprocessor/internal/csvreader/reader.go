package csvreader

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// RawRow representa una fila cruda del archivo log/CSV.
type RawRow struct {
	Tagname     string
	TimeStamp   string
	Value       string
	DataQuality string
}

// ReadResult contiene las filas leídas y el id_serial extraído del primer tagname válido.
// Así evitamos abrir el archivo dos veces.
type ReadResult struct {
	Rows     []RawRow
	IDSerial string // Primer id_serial encontrado en el archivo.
}

// Read abre el archivo UNA sola vez, extrae las filas y el id_serial en el mismo paso.
func Read(filePath string) (*ReadResult, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("no se pudo abrir [%s]: %w", filePath, err)
	}
	defer file.Close()

	rows := make([]RawRow, 0, 256)
	idSerial := ""

	scanner := bufio.NewScanner(file)
	// Buffer ampliado para líneas largas
	scanner.Buffer(make([]byte, 64*1024), 64*1024)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		if line == "" || line == "[Data]" {
			continue
		}
		if strings.EqualFold(line, "Tagname,TimeStamp,Value,DataQuality") {
			continue
		}

		parts := strings.SplitN(line, ",", 4)
		if len(parts) != 4 {
			return nil, fmt.Errorf("línea inválida: %s", line)
		}

		row := RawRow{
			Tagname:     strings.TrimSpace(parts[0]),
			TimeStamp:   strings.TrimSpace(parts[1]),
			Value:       strings.TrimSpace(parts[2]),
			DataQuality: strings.TrimSpace(parts[3]),
		}
		rows = append(rows, row)

		// Extrae id_serial la primera vez que lo encontramos
		if idSerial == "" {
			idSerial = extractIDSerial(row.Tagname)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error leyendo [%s]: %w", filePath, err)
	}

	if idSerial == "" {
		return nil, fmt.Errorf("no se pudo extraer id_serial desde [%s]", filePath)
	}

	return &ReadResult{Rows: rows, IDSerial: idSerial}, nil
}

// extractIDSerial obtiene el id_serial limpio desde un tagname.
// Ejemplo: 151.21.49.121--1.AI23 → 151.21.49.121
func extractIDSerial(tag string) string {
	lastDot := strings.LastIndex(tag, ".")
	if lastDot == -1 {
		return ""
	}
	left := tag[:lastDot]
	idSerial := strings.Split(left, "--")[0]
	return strings.TrimSpace(idSerial)
}
