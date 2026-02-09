package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
)

type uploadResponse struct {
	ScanID          string `json:"scanId"`
	ProductID       string `json:"productId"`
	CreatedFindings int    `json:"createdFindings"`
	Duplicates      int    `json:"duplicates"`
	ProductCreated  bool   `json:"productCreated"`
}

func main() {
	apiURL := flag.String("api-url", "http://localhost:8080", "API base URL")
	filePath := flag.String("file", "", "Path to report file")
	scanner := flag.String("scanner", "", "Scanner type (trivy|zap|semgrep)")
	productName := flag.String("product", "", "Product name")
	productVersion := flag.String("version", "", "Product version")
	productIdentifier := flag.String("identifier", "", "Product identifier")
	token := flag.String("token", "", "JWT token (or set LOTUS_WARDEN_TOKEN)")
	flag.Parse()

	if *scanner == "" {
		fmt.Fprintln(os.Stderr, "scanner is required")
		os.Exit(1)
	}
	if *filePath == "" {
		fmt.Fprintln(os.Stderr, "file is required")
		os.Exit(1)
	}
	if *token == "" {
		*token = os.Getenv("LOTUS_WARDEN_TOKEN")
	}
	if *token == "" {
		fmt.Fprintln(os.Stderr, "token is required")
		os.Exit(1)
	}

	body, contentType, err := buildMultipartBody(*filePath, *scanner, *productName, *productVersion, *productIdentifier)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to build request: %v\n", err)
		os.Exit(1)
	}

	request, err := http.NewRequest("POST", fmt.Sprintf("%s/api/v1/scans/upload", *apiURL), body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to create request: %v\n", err)
		os.Exit(1)
	}
	request.Header.Set("Content-Type", contentType)
	request.Header.Set("Authorization", "Bearer "+*token)

	fmt.Printf("Uploading %s...\n", filepath.Base(*filePath))
	resp, err := http.DefaultClient.Do(request)
	if err != nil {
		fmt.Fprintf(os.Stderr, "upload failed: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	payload, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to read response: %v\n", err)
		os.Exit(1)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		fmt.Fprintf(os.Stderr, "upload failed (%d): %s\n", resp.StatusCode, string(payload))
		os.Exit(1)
	}

	var result uploadResponse
	if err := json.Unmarshal(payload, &result); err != nil {
		fmt.Fprintf(os.Stderr, "invalid response: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Scan ID: %s\n", result.ScanID)
	if result.ProductID != "" {
		fmt.Printf("Product ID: %s\n", result.ProductID)
	}
	fmt.Printf("Created findings: %d\n", result.CreatedFindings)
	fmt.Printf("Duplicates: %d\n", result.Duplicates)
	if result.ProductCreated {
		fmt.Println("Product created: yes")
	} else {
		fmt.Println("Product created: no")
	}
}

func buildMultipartBody(filePath, scanner, productName, productVersion, productIdentifier string) (io.Reader, string, error) {
	cleanPath, err := filepath.Abs(filepath.Clean(filePath))
	if err != nil {
		return nil, "", err
	}
	info, err := os.Stat(cleanPath)
	if err != nil {
		return nil, "", err
	}
	if !info.Mode().IsRegular() {
		return nil, "", fmt.Errorf("report file is not a regular file")
	}
	// #nosec G304 -- file path is validated and opened as a regular file.
	file, err := os.Open(cleanPath)
	if err != nil {
		return nil, "", err
	}
	defer file.Close()

	var buffer bytes.Buffer
	writer := multipart.NewWriter(&buffer)

	part, err := writer.CreateFormFile("report", filepath.Base(cleanPath))
	if err != nil {
		return nil, "", err
	}
	if _, err := io.Copy(part, file); err != nil {
		return nil, "", err
	}

	if err := writer.WriteField("scanner_type", scanner); err != nil {
		return nil, "", err
	}
	if productName != "" {
		if err := writer.WriteField("product_name", productName); err != nil {
			return nil, "", err
		}
	}
	if productVersion != "" {
		if err := writer.WriteField("product_version", productVersion); err != nil {
			return nil, "", err
		}
	}
	if productIdentifier != "" {
		if err := writer.WriteField("product_identifier", productIdentifier); err != nil {
			return nil, "", err
		}
	}

	if err := writer.Close(); err != nil {
		return nil, "", err
	}

	return &buffer, writer.FormDataContentType(), nil
}
