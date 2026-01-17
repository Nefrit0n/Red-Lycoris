package objectstore

import (
	"context"
	"fmt"
	"io"
	"strings"

	"lotus-warden/backend/internal/config"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type Store interface {
	PutObject(ctx context.Context, key string, reader io.Reader, size int64, contentType string) error
	GetObject(ctx context.Context, key string) (io.ReadCloser, error)
	DeleteObject(ctx context.Context, key string) error
}

type MinioStore struct {
	client *minio.Client
	bucket string
}

func NewMinioStore(cfg config.Config) (*MinioStore, error) {
	useSSL := strings.ToLower(cfg.ObjectStoreUseSSL) == "true"
	client, err := minio.New(cfg.ObjectStoreEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.ObjectStoreAccessKey, cfg.ObjectStoreSecretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, err
	}
	store := &MinioStore{client: client, bucket: cfg.ObjectStoreBucket}
	if err := store.ensureBucket(context.Background()); err != nil {
		return nil, err
	}
	return store, nil
}

func (m *MinioStore) ensureBucket(ctx context.Context) error {
	exists, err := m.client.BucketExists(ctx, m.bucket)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	if err := m.client.MakeBucket(ctx, m.bucket, minio.MakeBucketOptions{}); err != nil {
		return fmt.Errorf("failed to create bucket %s: %w", m.bucket, err)
	}
	return nil
}

func (m *MinioStore) PutObject(ctx context.Context, key string, reader io.Reader, size int64, contentType string) error {
	_, err := m.client.PutObject(ctx, m.bucket, key, reader, size, minio.PutObjectOptions{ContentType: contentType})
	return err
}

func (m *MinioStore) GetObject(ctx context.Context, key string) (io.ReadCloser, error) {
	object, err := m.client.GetObject(ctx, m.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, err
	}
	return object, nil
}

func (m *MinioStore) DeleteObject(ctx context.Context, key string) error {
	return m.client.RemoveObject(ctx, m.bucket, key, minio.RemoveObjectOptions{})
}
