package loadtest

import (
	"context"
	"io"
	"net/http"
	"strings"
	"time"
)

type HTTPClient struct {
	baseURL string
	token   string
	client  *http.Client
}

func NewHTTPClient(baseURL, token string) *HTTPClient {
	return NewHTTPClientWithTimeout(baseURL, token, 2*time.Minute)
}

func NewHTTPClientWithTimeout(baseURL, token string, timeout time.Duration) *HTTPClient {
	if timeout < 0 {
		timeout = 2 * time.Minute
	}
	return &HTTPClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		token:   strings.TrimSpace(token),
		client: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *HTTPClient) Do(ctx context.Context, method, path string, body io.Reader) (*http.Response, time.Time, time.Duration, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return nil, time.Time{}, 0, err
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	started := time.Now()
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, started, time.Since(started), err
	}
	return resp, started, time.Since(started), nil
}
