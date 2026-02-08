package main

import (
	"bytes"
	"io"
	"mime"
	"mime/multipart"
	"os"
	"path/filepath"
	"testing"
)

func TestBuildMultipartBody(t *testing.T) {
	dir := t.TempDir()
	filePath := filepath.Join(dir, "report.json")
	if err := os.WriteFile(filePath, []byte(`{"ok":true}`), 0o600); err != nil {
		t.Fatalf("write temp file: %v", err)
	}

	reader, contentType, err := buildMultipartBody(filePath, "trivy", "product", "1.0.0", "prod-1")
	if err != nil {
		t.Fatalf("buildMultipartBody: %v", err)
	}

	mediaType, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		t.Fatalf("parse content type: %v", err)
	}
	if mediaType != "multipart/form-data" {
		t.Fatalf("expected multipart/form-data, got %s", mediaType)
	}

	mr := multipart.NewReader(reader, params["boundary"])
	fields := map[string]string{}
	var filePart bytes.Buffer

	for {
		part, err := mr.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("next part: %v", err)
		}
		name := part.FormName()
		if name == "report" {
			if _, err := io.Copy(&filePart, part); err != nil {
				t.Fatalf("read report part: %v", err)
			}
			continue
		}
		data, err := io.ReadAll(part)
		if err != nil {
			t.Fatalf("read field %s: %v", name, err)
		}
		fields[name] = string(data)
	}

	if filePart.String() != `{"ok":true}` {
		t.Fatalf("unexpected report payload: %s", filePart.String())
	}
	if fields["scanner_type"] != "trivy" {
		t.Fatalf("expected scanner_type trivy, got %s", fields["scanner_type"])
	}
	if fields["product_name"] != "product" {
		t.Fatalf("expected product_name product, got %s", fields["product_name"])
	}
	if fields["product_version"] != "1.0.0" {
		t.Fatalf("expected product_version 1.0.0, got %s", fields["product_version"])
	}
	if fields["product_identifier"] != "prod-1" {
		t.Fatalf("expected product_identifier prod-1, got %s", fields["product_identifier"])
	}
}
