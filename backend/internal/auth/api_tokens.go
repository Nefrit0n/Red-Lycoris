package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

const (
	patPrefixLiteral = "rl_pat_"
	patPrefixSize    = 8
	patSecretBytes   = 32
)

func GeneratePAT() (fullToken, prefix, hash string, err error) {
	prefixRaw := make([]byte, 5)
	if _, err = rand.Read(prefixRaw); err != nil {
		return "", "", "", fmt.Errorf("generate prefix: %w", err)
	}
	prefix = strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(prefixRaw))
	if len(prefix) != patPrefixSize {
		return "", "", "", errors.New("unexpected generated prefix size")
	}

	secretRaw := make([]byte, patSecretBytes)
	if _, err = rand.Read(secretRaw); err != nil {
		return "", "", "", fmt.Errorf("generate secret: %w", err)
	}
	secret := base64.RawURLEncoding.EncodeToString(secretRaw)
	hash = HashPATSecret(secret)
	fullToken = patPrefixLiteral + prefix + "_" + secret
	return fullToken, prefix, hash, nil
}

func ParsePAT(token string) (prefix, secret string, err error) {
	value := strings.TrimSpace(token)
	if !strings.HasPrefix(value, patPrefixLiteral) {
		return "", "", errors.New("invalid token prefix")
	}
	// SplitN(..., 4) keeps underscores inside base64url secret intact
	parts := strings.SplitN(value, "_", 4)
	if len(parts) != 4 {
		return "", "", errors.New("invalid token format")
	}
	prefix = strings.TrimSpace(parts[2])
	secret = strings.TrimSpace(parts[3])
	if len(prefix) != patPrefixSize {
		return "", "", errors.New("invalid token prefix length")
	}
	if _, decodeErr := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(prefix)); decodeErr != nil {
		return "", "", errors.New("invalid token prefix encoding")
	}
	if _, decodeErr := base64.RawURLEncoding.DecodeString(secret); decodeErr != nil {
		return "", "", errors.New("invalid token secret encoding")
	}
	if len(secret) < 32 {
		return "", "", errors.New("invalid token secret size")
	}
	return prefix, secret, nil
}

func HashPATSecret(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}
