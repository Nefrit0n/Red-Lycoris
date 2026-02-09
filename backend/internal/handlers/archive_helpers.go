package handlers

import (
	"bufio"
	"io"

	"red-lycoris/backend/internal/archive"
)

const supportedArchiveMessage = "Неподдерживаемый формат архива. Поддерживаются: zip, tar.gz, tgz."

func detectArchiveFormat(reader io.Reader) (archive.ArchiveFormat, *bufio.Reader, error) {
	buffered := bufio.NewReader(reader)
	format, err := archive.DetectArchiveFormat(buffered)
	if err != nil {
		return archive.ArchiveFormatUnknown, buffered, err
	}
	return format, buffered, nil
}

func isSupportedArchiveFormat(format archive.ArchiveFormat) bool {
	switch format {
	case archive.ArchiveFormatZip, archive.ArchiveFormatTarGz:
		return true
	default:
		return false
	}
}
