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
// Supports ZIP and tar.gz formats based on detected magic bytes.
func Extract(archivePath string, dest string, maxBytes int64) error {
	if err := os.MkdirAll(dest, 0o750); err != nil {
		return err
	}
	format, err := DetectArchiveFormatFromPath(archivePath)
	if err != nil {
		return err
	}
	return ExtractWithFormat(archivePath, dest, maxBytes, format)
}

// ExtractWithFormat extracts an archive using the provided format.
func ExtractWithFormat(archivePath string, dest string, maxBytes int64, format ArchiveFormat) error {
	switch format {
	case ArchiveFormatZip:
		return ExtractZip(archivePath, dest, maxBytes)
	case ArchiveFormatTarGz:
		return ExtractTarGz(archivePath, dest, maxBytes)
	case ArchiveFormatTar:
		return ExtractTar(archivePath, dest, maxBytes)
	default:
		return fmt.Errorf("unsupported archive format")
	}
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

// ExtractTar extracts a tar archive to the destination directory.
func ExtractTar(path string, dest string, maxBytes int64) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	tr := tar.NewReader(file)
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
	clean := filepath.Clean(name)
	if clean == "." || clean == string(os.PathSeparator) {
		return fmt.Errorf("invalid archive entry: empty path")
	}
	if clean == ".." || strings.HasPrefix(clean, ".."+string(os.PathSeparator)) {
		return fmt.Errorf("invalid archive entry: path traversal detected")
	}
	if filepath.IsAbs(clean) {
		return fmt.Errorf("invalid archive entry: absolute path not allowed")
	}
	destClean := filepath.Clean(dest)
	target := filepath.Join(destClean, clean)
	if !strings.HasPrefix(target, destClean+string(os.PathSeparator)) {
		return fmt.Errorf("invalid archive entry: path escapes destination")
	}
	return nil
}
