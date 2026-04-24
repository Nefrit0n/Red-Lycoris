package loadtest

import (
	cryptorand "crypto/rand"
	"math/big"
)

// cryptoIntn returns a uniform random integer in [0, max).
// It uses crypto/rand to avoid predictable sequences in load generation.
func cryptoIntn(max int) (int, error) {
	if max <= 0 {
		return 0, nil
	}
	n, err := cryptorand.Int(cryptorand.Reader, big.NewInt(int64(max)))
	if err != nil {
		return 0, err
	}
	return int(n.Int64()), nil
}
