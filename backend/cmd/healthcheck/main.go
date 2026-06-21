// Command healthcheck is a tiny self-contained probe used by the distroless
// runtime image, where no shell or curl is available for HEALTHCHECK.
package main

import (
	"net/http"
	"os"
	"time"
)

func main() {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://127.0.0.1:8080/healthz")
	if err != nil {
		os.Exit(1)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		os.Exit(1)
	}
}
