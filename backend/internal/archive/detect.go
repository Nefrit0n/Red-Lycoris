package archive

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
)

// ArchiveFormat describes a supported archive type.
type ArchiveFormat int

const (
	ArchiveFormatUnknown ArchiveFormat = iota
	ArchiveFormatZip
	ArchiveFormatTarGz
	ArchiveFormatTar
)

func (f ArchiveFormat) String() string {
	switch f {
	case ArchiveFormatZip:
		return "zip"
	case ArchiveFormatTarGz:
		return "targz"
	case ArchiveFormatTar:
		return "tar"
	default:
		return "unknown"
	}
}

// Extension returns a canonical extension for the archive format.
func (f ArchiveFormat) Extension() string {
	switch f {
	case ArchiveFormatZip:
		return ".zip"
	case ArchiveFormatTarGz:
		return ".tar.gz"
	case ArchiveFormatTar:
		return ".tar"
	default:
		return ""
	}
}

// DetectArchiveFormat inspects the first bytes of the reader and returns the archive format.
// The reader is not consumed thanks to bufio.Reader.Peek usage.
func DetectArchiveFormat(r io.Reader) (ArchiveFormat, error) {
	br := bufio.NewReader(r)

	head, err := br.Peek(4)
	if err != nil && len(head) < 4 {
		if err == io.EOF {
			return ArchiveFormatUnknown, nil
		}
		return ArchiveFormatUnknown, err
	}

	if bytes.HasPrefix(head, []byte("PK\x03\x04")) ||
		bytes.HasPrefix(head, []byte("PK\x05\x06")) ||
		bytes.HasPrefix(head, []byte("PK\x07\x08")) {
		return ArchiveFormatZip, nil
	}

	if len(head) >= 2 && head[0] == 0x1f && head[1] == 0x8b {
		return ArchiveFormatTarGz, nil
	}

	block, err := br.Peek(512)
	if err != nil && len(block) < 512 {
		if err == io.EOF {
			return ArchiveFormatUnknown, nil
		}
		return ArchiveFormatUnknown, err
	}
	if len(block) >= 262 && bytes.Equal(block[257:262], []byte("ustar")) {
		return ArchiveFormatTar, nil
	}

	return ArchiveFormatUnknown, nil
}

// DetectArchiveFormatFromPath opens the file and detects its archive format.
func DetectArchiveFormatFromPath(path string) (ArchiveFormat, error) {
	file, err := openArchiveFile(path)
	if err != nil {
		return ArchiveFormatUnknown, err
	}
	defer file.Close()

	format, err := DetectArchiveFormat(file)
	if err != nil {
		return ArchiveFormatUnknown, fmt.Errorf("detect archive format: %w", err)
	}
	return format, nil
}
