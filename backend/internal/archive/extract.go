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
	cleanPath, err := cleanArchivePath(path)
	if err != nil {
		return err
	}
	r, err := zip.OpenReader(cleanPath)
	if err != nil {
		return err
	}
	defer r.Close()

	var extracted int64
	for _, f := range r.File {
		targetPath, err := safeJoin(dest, f.Name)
		if err != nil {
			return err
		}
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
		// #nosec G304 -- targetPath is validated to stay within dest.
		out, err := os.Create(targetPath)
		if err != nil {
			in.Close()
			return err
		}
		remaining := remainingBytes(maxBytes, extracted)
		if maxBytes > 0 && remaining <= 0 {
			closeWithErr(&err, in)
			closeWithErr(&err, out)
			return fmt.Errorf("extracted content exceeds limit of %d bytes", maxBytes)
		}
		written, err := copyWithLimit(out, in, remaining)
		closeWithErr(&err, in)
		closeWithErr(&err, out)
		if err != nil {
			return err
		}
		extracted += written
		if maxBytes > 0 && extracted > maxBytes {
			return fmt.Errorf("extracted content exceeds limit of %d bytes", maxBytes)
		}
	}
	return nil
}

// ExtractTarGz extracts a gzipped tar archive to the destination directory.
func ExtractTarGz(path string, dest string, maxBytes int64) error {
	file, err := openArchiveFile(path)
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
		targetPath, err := safeJoin(dest, header.Name)
		if err != nil {
			return err
		}
		// Skip symlinks and hard links for security
		if header.Typeflag == tar.TypeSymlink || header.Typeflag == tar.TypeLink {
			continue
		}
		if header.FileInfo().IsDir() {
			if err := os.MkdirAll(targetPath, 0o750); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o750); err != nil {
			return err
		}
		// #nosec G304 -- targetPath is validated to stay within dest.
		out, err := os.Create(targetPath)
		if err != nil {
			return err
		}
		remaining := remainingBytes(maxBytes, extracted)
		if maxBytes > 0 && remaining <= 0 {
			closeWithErr(&err, out)
			return fmt.Errorf("extracted content exceeds limit of %d bytes", maxBytes)
		}
		written, err := copyWithLimit(out, tr, remaining)
		closeWithErr(&err, out)
		if err != nil {
			return err
		}
		extracted += written
		if maxBytes > 0 && extracted > maxBytes {
			return fmt.Errorf("extracted content exceeds limit of %d bytes", maxBytes)
		}
	}
	return nil
}

// ExtractTar extracts a tar archive to the destination directory.
func ExtractTar(path string, dest string, maxBytes int64) error {
	file, err := openArchiveFile(path)
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
		targetPath, err := safeJoin(dest, header.Name)
		if err != nil {
			return err
		}
		if header.Typeflag == tar.TypeSymlink || header.Typeflag == tar.TypeLink {
			continue
		}
		if header.FileInfo().IsDir() {
			if err := os.MkdirAll(targetPath, 0o750); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(targetPath), 0o750); err != nil {
			return err
		}
		// #nosec G304 -- targetPath is validated to stay within dest.
		out, err := os.Create(targetPath)
		if err != nil {
			return err
		}
		remaining := remainingBytes(maxBytes, extracted)
		if maxBytes > 0 && remaining <= 0 {
			closeWithErr(&err, out)
			return fmt.Errorf("extracted content exceeds limit of %d bytes", maxBytes)
		}
		written, err := copyWithLimit(out, tr, remaining)
		closeWithErr(&err, out)
		if err != nil {
			return err
		}
		extracted += written
		if maxBytes > 0 && extracted > maxBytes {
			return fmt.Errorf("extracted content exceeds limit of %d bytes", maxBytes)
		}
	}
	return nil
}

func safeJoin(dest string, name string) (string, error) {
	clean := filepath.Clean(name)
	if clean == "." || clean == string(os.PathSeparator) {
		return "", fmt.Errorf("invalid archive entry: empty path")
	}
	if clean == ".." || strings.HasPrefix(clean, ".."+string(os.PathSeparator)) {
		return "", fmt.Errorf("invalid archive entry: path traversal detected")
	}
	if filepath.IsAbs(clean) {
		return "", fmt.Errorf("invalid archive entry: absolute path not allowed")
	}
	destClean := filepath.Clean(dest)
	target := filepath.Join(destClean, clean)
	if !strings.HasPrefix(target, destClean+string(os.PathSeparator)) {
		return "", fmt.Errorf("invalid archive entry: path escapes destination")
	}
	return target, nil
}

func cleanArchivePath(path string) (string, error) {
	if strings.ContainsRune(path, '\x00') {
		return "", fmt.Errorf("invalid archive path")
	}
	absPath, err := filepath.Abs(filepath.Clean(path))
	if err != nil {
		return "", fmt.Errorf("resolve archive path: %w", err)
	}
	info, err := os.Stat(absPath)
	if err != nil {
		return "", err
	}
	if !info.Mode().IsRegular() {
		return "", fmt.Errorf("archive path is not a regular file")
	}
	return absPath, nil
}

func openArchiveFile(path string) (*os.File, error) {
	cleanPath, err := cleanArchivePath(path)
	if err != nil {
		return nil, err
	}
	// #nosec G304 -- path is validated as a regular file before opening.
	return os.Open(cleanPath)
}

func remainingBytes(maxBytes int64, extracted int64) int64 {
	if maxBytes <= 0 {
		return -1
	}
	return maxBytes - extracted
}

func copyWithLimit(dst io.Writer, src io.Reader, maxBytes int64) (int64, error) {
	if maxBytes < 0 {
		return io.Copy(dst, src)
	}
	limited := io.LimitReader(src, maxBytes+1)
	written, err := io.Copy(dst, limited)
	if written > maxBytes {
		return written, fmt.Errorf("extracted content exceeds limit of %d bytes", maxBytes)
	}
	return written, err
}

func closeWithErr(err *error, closer io.Closer) {
	if cerr := closer.Close(); cerr != nil && *err == nil {
		*err = cerr
	}
}
