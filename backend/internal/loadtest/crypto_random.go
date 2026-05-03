package loadtest

import (
	cryptorand "crypto/rand"
	"math/big"
)

// cryptoIntn returns a uniform random integer in [0, n).
// It uses crypto/rand to avoid predictable sequences in load generation.
func cryptoIntn(n int) (int, error) {
	if n <= 0 {
		return 0, nil
	}
	r, err := cryptorand.Int(cryptorand.Reader, big.NewInt(int64(n)))
	if err != nil {
		return 0, err
	}
	return int(r.Int64()), nil
}
