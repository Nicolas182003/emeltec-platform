// Package alertclient envía notificaciones de error al sistema de alertas de main-api.
//
// Cuando el csvprocessor no puede procesar un archivo después de todos sus
// reintentos, llama a este cliente para que main-api despache un correo a los
// administradores avisando del problema.
//
// Comunicación:
//
//	csvprocessor → POST http://<MAIN_API_URL>/internal/alerts
//	               Header: x-internal-key: <INTERNAL_API_KEY>
//
// Diseño importante:
//
//	Si main-api no está disponible, esta función SOLO loguea el problema.
//	Nunca interrumpe el flujo principal — las alertas son secundarias.
package alertclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

// alertPayload es el cuerpo JSON que espera el endpoint /internal/alerts de main-api.
type alertPayload struct {
	Tipo  string      `json:"tipo"`  // Tipo de alerta: "error_archivo", etc.
	Datos interface{} `json:"datos"` // Payload del evento — varía según el tipo.
}

// Client contiene la configuración necesaria para comunicarse con main-api.
type Client struct {
	mainAPIURL     string       // URL base de main-api (ej: http://localhost:3000).
	internalAPIKey string       // Clave secreta compartida entre servicios.
	httpClient     *http.Client // Cliente HTTP reutilizable con timeout.
}

// New crea un nuevo Client con la URL y clave indicadas.
// El timeout de 5 segundos evita que una llamada lenta bloquee el pipeline.
func New(mainAPIURL, internalAPIKey string) *Client {
	return &Client{
		mainAPIURL:     mainAPIURL,
		internalAPIKey: internalAPIKey,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// EnviarAlerta manda una notificación de alerta a main-api.
//
// Parámetros:
//   - tipo:  identificador del tipo de alerta (ej: "error_archivo")
//   - datos: mapa con información del evento (archivo, error, etc.)
//
// Si main-api no responde o responde con error, se loguea pero NO se propaga
// la excepción — esto no debe detener el pipeline.
func (c *Client) EnviarAlerta(tipo string, datos interface{}) {
	// Serializa el cuerpo de la petición.
	payload := alertPayload{Tipo: tipo, Datos: datos}
	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("⚠️  alertclient: no se pudo serializar el payload: %v", err)
		return
	}

	// Construye la petición HTTP hacia main-api.
	url := fmt.Sprintf("%s/internal/alerts", c.mainAPIURL)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		log.Printf("⚠️  alertclient: no se pudo crear la petición: %v", err)
		return
	}

	// Cabeceras requeridas por main-api.
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-internal-key", c.internalAPIKey) // Autenticación interna.

	// Ejecuta la petición.
	resp, err := c.httpClient.Do(req)
	if err != nil {
		// main-api no disponible — se loguea y se continúa.
		log.Printf("⚠️  alertclient: no se pudo conectar con main-api: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("⚠️  alertclient: main-api respondió %d para alerta [%s]", resp.StatusCode, tipo)
		return
	}

	log.Printf("📨 alertclient: alerta [%s] enviada a main-api (%d)", tipo, resp.StatusCode)
}
