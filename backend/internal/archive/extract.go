// Package archive provides utilities for extracting compressed archives
// such as ZIP and tar.gz files with security validations.
package archive

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Extract extracts an archive to the destination directory.
// Supports ZIP and tar.gz formats based on file extension.
func Extract(archivePath string, dest string, maxBytes int64) error {
	if err := os.MkdirAll(dest, 0o750); err != nil {
		return err
	}

	lower := strings.ToLower(archivePath)
	if strings.HasSuffix(lower, ".zip") {
		return ExtractZip(archivePath, dest, maxBytes)
	}
	return ExtractTarGz(archivePath, dest, maxBytes)
}

// ExtractZip extracts a ZIP archive to the destination directory.
func ExtractZip(path string, dest string, maxBytes int64) error {
	r, err := zip.OpenReader(path)
	if err != nil {
		return err
	}
	defer r.Close()

	var extracted int64
	for _, f := range r.File {
		if err := validatePath(dest, f.Name); err != nil {
			return err
		}
		targetPath := filepath.Join(dest, f.Name)
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(targetPath, 0o750); err != nil {
				return err
			}
			continue
		}
		// Skip symlinks for security
		if f.Mode()&os.ModeSymlink != 0 {
			continue
		}
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o750); err != nil {
			return err
		}
		in, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.Create(targetPath)
		if err != nil {
			in.Close()
			return err
		}
		written, err := io.Copy(out, in)
		in.Close()
		out.Close()
		if err != nil {
			return err
		}
		extracted += written
		if extracted > maxBytes {
			return fmt.Errorf("extracted content exceeds limit of %d bytes", maxBytes)
		}
	}
	return nil
}

// ExtractTarGz extracts a gzipped tar archive to the destination directory.
func ExtractTarGz(path string, dest string, maxBytes int64) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	gz, err := gzip.NewReader(file)
	if err != nil {
		return err
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	var extracted int64

	for {
		header, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return err
		}
		if err := validatePath(dest, header.Name); err != nil {
			return err
		}
		// Skip symlinks and hard links for security
		if header.Typeflag == tar.TypeSymlink || header.Typeflag == tar.TypeLink {
			continue
		}
		targetPath := filepath.Join(dest, header.Name)
		if header.FileInfo().IsDir() {
			if err := os.MkdirAll(targetPath, 0o750); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o750); err != nil {
			return err
		}
		out, err := os.Create(targetPath)
		if err != nil {
			return err
		}
		written, err := io.Copy(out, tr)
		out.Close()
		if err != nil {
			return err
		}
		extracted += written
		if extracted > maxBytes {
			return fmt.Errorf("extracted content exceeds limit of %d bytes", maxBytes)
		}
	}
	return nil
}

// validatePath checks that the archive entry path is safe and doesn't escape
// the destination directory (path traversal protection).
func validatePath(dest string, name string) error {
	if strings.Contains(name, "..") {
		return fmt.Errorf("invalid archive entry: path traversal detected")
	}
	clean := filepath.Clean(name)
	if filepath.IsAbs(clean) {
		return fmt.Errorf("invalid archive entry: absolute path not allowed")
	}
	target := filepath.Join(dest, clean)
	if !strings.HasPrefix(target, filepath.Clean(dest)+string(os.PathSeparator)) {
		return fmt.Errorf("invalid archive entry: path escapes destination")
	}
	return nil
}
