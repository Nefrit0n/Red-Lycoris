package auth

import "github.com/alexedwards/argon2id"

var argonParams = &argon2id.Params{
	Memory:      64 * 1024,
	Iterations:  3,
	Parallelism: 2,
	SaltLength:  16,
	KeyLength:   32,
}

func Hash(password string) (string, error) {
	return argon2id.CreateHash(password, argonParams)
}

func Verify(password, hash string) (bool, error) {
	return argon2id.ComparePasswordAndHash(password, hash)
}
