package filemanager

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// EnsureDirectories crea las carpetas necesarias si no existen.
func EnsureDirectories(dirs ...string) error {
	for _, dir := range dirs {
		if strings.TrimSpace(dir) == "" {
			return fmt.Errorf("directorio vacío en configuración")
		}

		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("no se pudo crear el directorio [%s]: %w", dir, err)
		}
	}

	return nil
}

// ListInputFiles devuelve la lista de archivos regulares encontrados en una carpeta.
// Filtra solo archivos con extensiones típicas de logs/CSV.
func ListInputFiles(inputDir string) ([]string, error) {
	entries, err := os.ReadDir(inputDir)
	if err != nil {
		return nil, fmt.Errorf("no se pudo leer el directorio [%s]: %w", inputDir, err)
	}

	files := make([]string, 0)

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		ext := strings.ToLower(filepath.Ext(name))

		if ext == ".csv" || ext == ".log" || ext == ".txt" {
			files = append(files, filepath.Join(inputDir, name))
		}
	}

	sort.Strings(files)
	return files, nil
}

// ExtractSerialIDFromFile lee el archivo crudo y trata de obtener el primer id_serial válido.
// Ejemplo:
//
//	151.21.49.121--1.AI23  -> 151.21.49.121
//
// Ignora:
// - líneas vacías
// - [Data]
// - encabezado Tagname,TimeStamp,Value,DataQuality
func ExtractSerialIDFromFile(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("no se pudo abrir el archivo [%s]: %w", filePath, err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		if line == "" || line == "[Data]" {
			continue
		}

		if strings.EqualFold(line, "Tagname,TimeStamp,Value,DataQuality") {
			continue
		}

		parts := strings.SplitN(line, ",", 2)
		if len(parts) < 1 {
			continue
		}

		tagname := strings.TrimSpace(parts[0])
		if tagname == "" {
			continue
		}

		idSerial, err := parseSerialIDFromTagname(tagname)
		if err == nil && idSerial != "" {
			return idSerial, nil
		}
	}

	if err := scanner.Err(); err != nil {
		return "", fmt.Errorf("error leyendo el archivo [%s]: %w", filePath, err)
	}

	return "", fmt.Errorf("no se pudo extraer id_serial desde [%s]", filePath)
}

// CopyToBackupBySerial crea un respaldo exacto del archivo original dentro de:
// raw_backup/<id_serial>/<nombre_archivo>
func CopyToBackupBySerial(sourcePath, backupRootDir, idSerial string) error {
	if strings.TrimSpace(idSerial) == "" {
		return fmt.Errorf("id_serial vacío para backup")
	}

	targetDir := filepath.Join(backupRootDir, idSerial)

	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return fmt.Errorf("no se pudo crear el directorio backup [%s]: %w", targetDir, err)
	}

	sourceFile, err := os.Open(sourcePath)
	if err != nil {
		return fmt.Errorf("no se pudo abrir el archivo origen [%s]: %w", sourcePath, err)
	}
	defer sourceFile.Close()

	targetPath := filepath.Join(targetDir, filepath.Base(sourcePath))

	targetFile, err := os.Create(targetPath)
	if err != nil {
		return fmt.Errorf("no se pudo crear el archivo backup [%s]: %w", targetPath, err)
	}
	defer targetFile.Close()

	if _, err := io.Copy(targetFile, sourceFile); err != nil {
		return fmt.Errorf("no se pudo copiar el archivo a backup [%s]: %w", targetPath, err)
	}

	return nil
}

// DeleteFile elimina el archivo original tras procesarlo exitosamente.
// El respaldo ya fue guardado en raw_backup/ antes de llamar esto.
func DeleteFile(filePath string) {
	_ = os.Remove(filePath)
}

// MoveToFailed mueve un archivo a la carpeta de fallidos.
func MoveToFailed(sourcePath, failedDir string) error {
	targetPath := filepath.Join(failedDir, filepath.Base(sourcePath))
	return moveFile(sourcePath, targetPath)
}

// moveFile mueve un archivo a una ruta nueva.
// Primero intenta renombrar; si falla por cruce de volumen, copia y luego elimina.
func moveFile(sourcePath, targetPath string) error {
	if _, err := os.Stat(targetPath); err == nil {
		if err := os.Remove(targetPath); err != nil {
			return fmt.Errorf("no se pudo reemplazar el archivo destino [%s]: %w", targetPath, err)
		}
	}

	if err := os.Rename(sourcePath, targetPath); err == nil {
		return nil
	}

	sourceFile, err := os.Open(sourcePath)
	if err != nil {
		return fmt.Errorf("no se pudo abrir el archivo origen [%s]: %w", sourcePath, err)
	}
	defer sourceFile.Close()

	targetFile, err := os.Create(targetPath)
	if err != nil {
		return fmt.Errorf("no se pudo crear el archivo destino [%s]: %w", targetPath, err)
	}
	defer targetFile.Close()

	if _, err := io.Copy(targetFile, sourceFile); err != nil {
		return fmt.Errorf("no se pudo copiar el archivo hacia [%s]: %w", targetPath, err)
	}

	if err := os.Remove(sourcePath); err != nil {
		return fmt.Errorf("no se pudo eliminar el archivo origen [%s]: %w", sourcePath, err)
	}

	return nil
}

// parseSerialIDFromTagname extrae el id_serial limpio desde el tagname.
// Ejemplo:
//
//	151.21.49.121--1.AI23 -> 151.21.49.121
func parseSerialIDFromTagname(tag string) (string, error) {
	lastDot := strings.LastIndex(tag, ".")
	if lastDot == -1 {
		return "", fmt.Errorf("tagname inválido: %s", tag)
	}

	left := tag[:lastDot]
	idSerial := strings.Split(left, "--")[0]
	idSerial = strings.TrimSpace(idSerial)

	if idSerial == "" {
		return "", fmt.Errorf("id_serial vacío en tagname: %s", tag)
	}

	return idSerial, nil
}
