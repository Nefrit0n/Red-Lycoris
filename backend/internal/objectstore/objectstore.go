package objectstore

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"strconv"
	"strings"
	"time"

	"red-lycoris/backend/internal/config"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type PresignedMultipartPart struct {
	PartNumber int    `json:"part_number"`
	URL        string `json:"url"`
}

type Store interface {
	PutObject(ctx context.Context, key string, reader io.Reader, size int64, contentType string) error
	GetObject(ctx context.Context, key string) (io.ReadCloser, error)
	DeleteObject(ctx context.Context, key string) error
	PresignPut(ctx context.Context, key string, expiry time.Duration) (string, error)
	CreateMultipartPlan(ctx context.Context, key string, parts int, expiry time.Duration) (uploadID, completeURL, abortURL string, partURLs []PresignedMultipartPart, err error)
	StatObject(ctx context.Context, key string) (size int64, etag string, err error)
}

type MinioStore struct {
	client *minio.Client
	core   *minio.Core
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
	bucket := strings.ToLower(strings.TrimSpace(cfg.ObjectStoreBucket))
	core, err := minio.NewCore(cfg.ObjectStoreEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.ObjectStoreAccessKey, cfg.ObjectStoreSecretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, err
	}
	store := &MinioStore{client: client, core: core, bucket: bucket}
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

func (m *MinioStore) PresignPut(ctx context.Context, key string, expiry time.Duration) (string, error) {
	u, err := m.client.PresignedPutObject(ctx, m.bucket, key, expiry)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

func (m *MinioStore) CreateMultipartPlan(ctx context.Context, key string, parts int, expiry time.Duration) (string, string, string, []PresignedMultipartPart, error) {
	uploadID, err := m.core.NewMultipartUpload(ctx, m.bucket, key, minio.PutObjectOptions{})
	if err != nil {
		return "", "", "", nil, err
	}
	partURLs := make([]PresignedMultipartPart, 0, parts)
	for i := 1; i <= parts; i++ {
		q := url.Values{}
		q.Set("uploadId", uploadID)
		q.Set("partNumber", strconv.Itoa(i))
		u, err := m.client.PresignHeader(ctx, "PUT", m.bucket, key, expiry, q, nil)
		if err != nil {
			return "", "", "", nil, err
		}
		partURLs = append(partURLs, PresignedMultipartPart{PartNumber: i, URL: u.String()})
	}
	completeQ := url.Values{}
	completeQ.Set("uploadId", uploadID)
	completeURL, err := m.client.PresignHeader(ctx, "POST", m.bucket, key, expiry, completeQ, nil)
	if err != nil {
		return "", "", "", nil, err
	}
	abortURL, err := m.client.PresignHeader(ctx, "DELETE", m.bucket, key, expiry, completeQ, nil)
	if err != nil {
		return "", "", "", nil, err
	}
	return uploadID, completeURL.String(), abortURL.String(), partURLs, nil
}

func (m *MinioStore) StatObject(ctx context.Context, key string) (int64, string, error) {
	st, err := m.client.StatObject(ctx, m.bucket, key, minio.StatObjectOptions{})
	if err != nil {
		return 0, "", err
	}
	return st.Size, st.ETag, nil
}
