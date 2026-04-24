package loadtest

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"time"
)

func SeedSARIF(ctx context.Context, baseURL, token, projectID, filePath string, timeout time.Duration) error {
	data, err := os.ReadFile(filepath.Clean(filePath)) // #nosec G304 -- filePath comes from trusted loadtest operator input
	if err != nil {
		return err
	}

	client := NewHTTPClientWithTimeout(baseURL, token, timeout)
	path := "/api/v1/import?project_id=" + url.QueryEscape(projectID)
	resp, _, _, err := client.Do(ctx, http.MethodPost, path, bytes.NewReader(data))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("seed failed: status=%d body=%s", resp.StatusCode, string(b))
	}
	return nil
}
