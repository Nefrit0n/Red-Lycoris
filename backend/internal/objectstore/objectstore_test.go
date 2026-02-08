package objectstore

import "testing"

func TestMinioStoreImplementsStore(t *testing.T) {
	var _ Store = (*MinioStore)(nil)
}
