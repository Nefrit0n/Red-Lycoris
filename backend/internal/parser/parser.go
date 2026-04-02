package parser

import (
	"context"

	"vulnscope/internal/domain"
)

type Parser interface {
	Parse(ctx context.Context, data []byte) ([]domain.Finding, error)
	CanParse(data []byte) bool
}
