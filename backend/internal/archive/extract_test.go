package archive

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"os"
	"path/filepath"
	"testing"
)

func TestDetectArchiveFormat(t *testing.T) {
	zipBytes := buildZipFixture(t, map[string]string{"file.txt": "hello"})
	format, err := DetectArchiveFormat(bytes.NewReader(zipBytes))
	if err != nil {
		t.Fatalf("detect zip failed: %v", err)
	}
	if format != ArchiveFormatZip {
		t.Fatalf("expected zip format, got %v", format)
	}

	gzBytes := buildTarGzFixture(t, map[string]string{"file.txt": "hello"})
	format, err = DetectArchiveFormat(bytes.NewReader(gzBytes))
	if err != nil {
		t.Fatalf("detect targz failed: %v", err)
	}
	if format != ArchiveFormatTarGz {
		t.Fatalf("expected targz format, got %v", format)
	}
}

func TestExtractZipAndTarGz(t *testing.T) {
	tempDir := t.TempDir()

	zipPath := filepath.Join(tempDir, "sample.zip")
	if err := os.WriteFile(zipPath, buildZipFixture(t, map[string]string{"a.txt": "zip content"}), 0o600); err != nil {
		t.Fatalf("write zip fixture failed: %v", err)
	}
	zipDest := filepath.Join(tempDir, "zip")
	if err := Extract(zipPath, zipDest, 1024*1024); err != nil {
		t.Fatalf("extract zip failed: %v", err)
	}
	if _, err := os.Stat(filepath.Join(zipDest, "a.txt")); err != nil {
		t.Fatalf("expected zip file extracted: %v", err)
	}

	tgzPath := filepath.Join(tempDir, "sample.tar.gz")
	if err := os.WriteFile(tgzPath, buildTarGzFixture(t, map[string]string{"b.txt": "tar content"}), 0o600); err != nil {
		t.Fatalf("write targz fixture failed: %v", err)
	}
	tgzDest := filepath.Join(tempDir, "targz")
	if err := Extract(tgzPath, tgzDest, 1024*1024); err != nil {
		t.Fatalf("extract targz failed: %v", err)
	}
	if _, err := os.Stat(filepath.Join(tgzDest, "b.txt")); err != nil {
		t.Fatalf("expected targz file extracted: %v", err)
	}
}

func TestExtractIgnoresExtensionWhenDetectingFormat(t *testing.T) {
	tempDir := t.TempDir()

	zipPath := filepath.Join(tempDir, "archive.bin")
	if err := os.WriteFile(zipPath, buildZipFixture(t, map[string]string{"c.txt": "zip content"}), 0o600); err != nil {
		t.Fatalf("write zip fixture failed: %v", err)
	}
	zipDest := filepath.Join(tempDir, "zip")
	if err := Extract(zipPath, zipDest, 1024*1024); err != nil {
		t.Fatalf("extract zip without extension failed: %v", err)
	}
	if _, err := os.Stat(filepath.Join(zipDest, "c.txt")); err != nil {
		t.Fatalf("expected zip file extracted: %v", err)
	}
}

func TestExtractRejectsZipSlip(t *testing.T) {
	tempDir := t.TempDir()

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	entry, err := zw.Create("../evil.txt")
	if err != nil {
		t.Fatalf("create zip entry failed: %v", err)
	}
	if _, err := entry.Write([]byte("evil")); err != nil {
		t.Fatalf("write zip entry failed: %v", err)
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("close zip writer failed: %v", err)
	}

	zipPath := filepath.Join(tempDir, "slip.zip")
	if err := os.WriteFile(zipPath, buf.Bytes(), 0o600); err != nil {
		t.Fatalf("write zip slip fixture failed: %v", err)
	}

	dest := filepath.Join(tempDir, "out")
	if err := Extract(zipPath, dest, 1024*1024); err == nil {
		t.Fatalf("expected zip slip extraction to fail")
	}
}

func buildZipFixture(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for name, content := range files {
		entry, err := zw.Create(name)
		if err != nil {
			t.Fatalf("create zip entry failed: %v", err)
		}
		if _, err := entry.Write([]byte(content)); err != nil {
			t.Fatalf("write zip entry failed: %v", err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("close zip writer failed: %v", err)
	}
	return buf.Bytes()
}

func buildTarGzFixture(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var buf bytes.Buffer
	gw := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gw)

	for name, content := range files {
		data := []byte(content)
		hdr := &tar.Header{
			Name: name,
			Mode: 0o600,
			Size: int64(len(data)),
		}
		if err := tw.WriteHeader(hdr); err != nil {
			t.Fatalf("write tar header failed: %v", err)
		}
		if _, err := tw.Write(data); err != nil {
			t.Fatalf("write tar data failed: %v", err)
		}
	}

	if err := tw.Close(); err != nil {
		t.Fatalf("close tar writer failed: %v", err)
	}
	if err := gw.Close(); err != nil {
		t.Fatalf("close gzip writer failed: %v", err)
	}
	return buf.Bytes()
}
