package parser

import (
	"context"

	"redlycoris/internal/domain"
)

type Parser interface {
	Parse(ctx context.Context, data []byte) ([]domain.Finding, error)
	CanParse(data []byte) bool
}
