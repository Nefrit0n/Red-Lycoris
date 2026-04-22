package api

import (
	"net/http"
	"time"

	"github.com/swaggest/swgui/v5emb"
)

const openAPIPath = "api/openapi.yaml"

func openAPIHandler(env string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if env != "dev" {
			http.NotFound(w, r)
			return
		}

		setPublicCacheHeaders(w, 10*time.Minute)
		http.ServeFile(w, r, openAPIPath)
	}
}

func docsHandler(env string) http.HandlerFunc {
	swagger := v5emb.New("RedLycoris API", "/api/openapi.yaml", "/api/docs")

	return func(w http.ResponseWriter, r *http.Request) {
		if env != "dev" {
			http.NotFound(w, r)
			return
		}

		setPublicCacheHeaders(w, time.Minute)
		swagger.ServeHTTP(w, r)
	}
}
