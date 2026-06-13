package main

import (
	"bytes"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type config struct {
	customDir  string
	runtimeDir string
	sans       string
	hostname   string
	nginxUID   int
	nginxGID   int
}

type certificatePair struct {
	certificate []byte
	privateKey  []byte
}

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))
	if err := run(loadConfig(), logger); err != nil {
		logger.Error("certinit failed", "error", err)
		os.Exit(1)
	}
}

func loadConfig() config {
	return config{
		customDir:  getEnv("RL_TLS_CUSTOM_DIR", "/etc/redlycoris/tls-custom"),
		runtimeDir: getEnv("RL_TLS_DIR", "/etc/redlycoris/tls"),
		sans:       os.Getenv("RL_TLS_SANS"),
		hostname:   os.Getenv("RL_HOSTNAME"),
		nginxUID:   101,
		nginxGID:   101,
	}
}

func run(cfg config, logger *slog.Logger) error {
	customState, err := inspectCustomDirectory(cfg.customDir)
	if err != nil {
		return fmt.Errorf("inspect custom TLS directory: %w", err)
	}

	var pair certificatePair
	var mode string

	switch customState {
	case "complete":
		pair, err = loadCustomCertificate(cfg.customDir)
		if err != nil {
			return fmt.Errorf("validate custom TLS certificate: %w", err)
		}
		mode = "user-cert"
	case "empty":
		pair, err = loadOrGenerateSelfSigned(cfg, logger)
		if err != nil {
			return fmt.Errorf("prepare self-signed TLS certificate: %w", err)
		}
		mode = "self-signed"
	default:
		return fmt.Errorf("custom TLS directory %q must contain both tls.key and tls.crt, or be empty", cfg.customDir)
	}

	if err := writeRuntimeFiles(cfg, pair, mode); err != nil {
		return fmt.Errorf("write runtime TLS files: %w", err)
	}

	logger.Info("TLS certificate is ready", "mode", mode, "directory", cfg.runtimeDir)
	return nil
}

func inspectCustomDirectory(dir string) (string, error) {
	entries, err := os.ReadDir(dir)
	if errors.Is(err, os.ErrNotExist) {
		return "empty", nil
	}
	if err != nil {
		return "", err
	}
	if len(entries) == 0 {
		return "empty", nil
	}

	keyExists, err := regularFileExists(filepath.Join(dir, "tls.key"))
	if err != nil {
		return "", err
	}
	certExists, err := regularFileExists(filepath.Join(dir, "tls.crt"))
	if err != nil {
		return "", err
	}
	if keyExists && certExists {
		return "complete", nil
	}
	return "incomplete", nil
}

func regularFileExists(path string) (bool, error) {
	info, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if !info.Mode().IsRegular() {
		return false, fmt.Errorf("%s is not a regular file", path)
	}
	return true, nil
}

func loadCustomCertificate(dir string) (certificatePair, error) {
	certPEM, err := os.ReadFile(filepath.Join(dir, "tls.crt"))
	if err != nil {
		return certificatePair{}, fmt.Errorf("read tls.crt: %w", err)
	}
	keyPEM, err := os.ReadFile(filepath.Join(dir, "tls.key"))
	if err != nil {
		return certificatePair{}, fmt.Errorf("read tls.key: %w", err)
	}

	if _, _, err := validateCertificatePair(certPEM, keyPEM, time.Now()); err != nil {
		return certificatePair{}, err
	}
	certificateCount, err := validateCertificatePEM(certPEM, "tls.crt")
	if err != nil {
		return certificatePair{}, err
	}

	fullchain := append([]byte(nil), bytes.TrimSpace(certPEM)...)
	caPath := filepath.Join(dir, "ca.crt")
	caPEM, err := os.ReadFile(caPath)
	if err == nil {
		if _, err := validateCertificatePEM(caPEM, "ca.crt"); err != nil {
			return certificatePair{}, err
		}
		if certificateCount == 1 {
			fullchain = append(fullchain, '\n')
			fullchain = append(fullchain, bytes.TrimSpace(caPEM)...)
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return certificatePair{}, fmt.Errorf("read ca.crt: %w", err)
	}
	fullchain = append(fullchain, '\n')

	return certificatePair{certificate: fullchain, privateKey: keyPEM}, nil
}

func validateCertificatePair(certPEM, keyPEM []byte, now time.Time) (*x509.Certificate, crypto.Signer, error) {
	cert, err := parseLeafCertificate(certPEM)
	if err != nil {
		return nil, nil, err
	}
	if now.Before(cert.NotBefore) {
		return nil, nil, fmt.Errorf("certificate is not valid before %s", cert.NotBefore.UTC().Format(time.RFC3339))
	}
	if !now.Before(cert.NotAfter) {
		return nil, nil, fmt.Errorf("certificate expired at %s", cert.NotAfter.UTC().Format(time.RFC3339))
	}

	signer, err := parsePrivateKey(keyPEM)
	if err != nil {
		return nil, nil, err
	}
	if err := publicKeysMatch(cert.PublicKey, signer.Public()); err != nil {
		return nil, nil, err
	}
	return cert, signer, nil
}

func parseLeafCertificate(certPEM []byte) (*x509.Certificate, error) {
	block, _ := pem.Decode(certPEM)
	if block == nil || block.Type != "CERTIFICATE" {
		return nil, errors.New("tls.crt does not contain a PEM CERTIFICATE block")
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse tls.crt: %w", err)
	}
	return cert, nil
}

func validateCertificatePEM(data []byte, name string) (int, error) {
	rest := data
	count := 0
	for {
		block, remaining := pem.Decode(rest)
		if block == nil {
			break
		}
		rest = remaining
		if block.Type != "CERTIFICATE" {
			return 0, fmt.Errorf("%s contains unexpected PEM block %q", name, block.Type)
		}
		if _, err := x509.ParseCertificate(block.Bytes); err != nil {
			return 0, fmt.Errorf("parse %s certificate: %w", name, err)
		}
		count++
	}
	if count == 0 {
		return 0, fmt.Errorf("%s does not contain a PEM CERTIFICATE block", name)
	}
	if len(bytes.TrimSpace(rest)) != 0 {
		return 0, fmt.Errorf("%s contains non-PEM data", name)
	}
	return count, nil
}

func parsePrivateKey(keyPEM []byte) (crypto.Signer, error) {
	block, rest := pem.Decode(keyPEM)
	if block == nil {
		return nil, errors.New("tls.key does not contain a PEM private key block")
	}
	if len(bytes.TrimSpace(rest)) != 0 {
		return nil, errors.New("tls.key contains unexpected trailing data")
	}
	if x509.IsEncryptedPEMBlock(block) {
		return nil, errors.New("encrypted private keys are not supported")
	}

	if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		signer, ok := key.(crypto.Signer)
		if !ok {
			return nil, fmt.Errorf("PKCS#8 private key type %T cannot sign certificates", key)
		}
		return signer, nil
	}
	if key, err := x509.ParseECPrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	return nil, errors.New("tls.key is not a supported PKCS#8, EC, or PKCS#1 private key")
}

func publicKeysMatch(certificateKey, privateKey crypto.PublicKey) error {
	certDER, err := x509.MarshalPKIXPublicKey(certificateKey)
	if err != nil {
		return fmt.Errorf("marshal certificate public key: %w", err)
	}
	keyDER, err := x509.MarshalPKIXPublicKey(privateKey)
	if err != nil {
		return fmt.Errorf("marshal private key public key: %w", err)
	}
	if !bytes.Equal(certDER, keyDER) {
		return errors.New("tls.key does not match tls.crt")
	}
	return nil
}

func loadOrGenerateSelfSigned(cfg config, logger *slog.Logger) (certificatePair, error) {
	certPath := filepath.Join(cfg.runtimeDir, "fullchain.crt")
	keyPath := filepath.Join(cfg.runtimeDir, "tls.key")
	certPEM, certErr := os.ReadFile(certPath)
	keyPEM, keyErr := os.ReadFile(keyPath)
	if certErr == nil && keyErr == nil {
		cert, _, err := validateCertificatePair(certPEM, keyPEM, time.Now())
		if err == nil && isSelfSigned(cert) {
			logger.Info("reusing existing self-signed TLS certificate", "expires", cert.NotAfter.UTC().Format(time.RFC3339))
			return certificatePair{certificate: certPEM, privateKey: keyPEM}, nil
		}
		logger.Info("existing runtime TLS certificate cannot be reused; generating a replacement")
	} else if certErr != nil && !errors.Is(certErr, os.ErrNotExist) {
		return certificatePair{}, fmt.Errorf("read existing fullchain.crt: %w", certErr)
	} else if keyErr != nil && !errors.Is(keyErr, os.ErrNotExist) {
		return certificatePair{}, fmt.Errorf("read existing tls.key: %w", keyErr)
	}

	return generateSelfSigned(cfg.sans, cfg.hostname, time.Now())
}

func isSelfSigned(cert *x509.Certificate) bool {
	return bytes.Equal(cert.RawIssuer, cert.RawSubject) &&
		cert.CheckSignature(cert.SignatureAlgorithm, cert.RawTBSCertificate, cert.Signature) == nil
}

func generateSelfSigned(configuredSANs, hostname string, now time.Time) (certificatePair, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return certificatePair{}, fmt.Errorf("generate ECDSA P-256 key: %w", err)
	}

	dnsNames, ipAddresses := collectSANs(configuredSANs, hostname)
	serialLimit := new(big.Int).Lsh(big.NewInt(1), 128)
	serial, err := rand.Int(rand.Reader, serialLimit)
	if err != nil {
		return certificatePair{}, fmt.Errorf("generate certificate serial number: %w", err)
	}

	template := &x509.Certificate{
		SerialNumber: serial,
		Subject: pkix.Name{
			CommonName: "Red Lycoris self-signed",
		},
		NotBefore:             now.Add(-5 * time.Minute),
		NotAfter:              now.Add(825 * 24 * time.Hour),
		KeyUsage:              x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		DNSNames:              dnsNames,
		IPAddresses:           ipAddresses,
	}

	certDER, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		return certificatePair{}, fmt.Errorf("create self-signed certificate: %w", err)
	}
	keyDER, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return certificatePair{}, fmt.Errorf("marshal private key: %w", err)
	}

	return certificatePair{
		certificate: pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER}),
		privateKey:  pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER}),
	}, nil
}

func collectSANs(configuredSANs, hostname string) ([]string, []net.IP) {
	values := []string{"localhost", "127.0.0.1", "::1"}
	if strings.TrimSpace(hostname) != "" {
		values = append(values, hostname)
	}
	values = append(values, strings.FieldsFunc(configuredSANs, func(r rune) bool {
		return r == ',' || r == ';' || r == ' ' || r == '\n' || r == '\t'
	})...)

	dnsSeen := make(map[string]struct{})
	ipSeen := make(map[string]struct{})
	var dnsNames []string
	var ipAddresses []net.IP
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if ip := net.ParseIP(value); ip != nil {
			canonical := ip.String()
			if _, exists := ipSeen[canonical]; !exists {
				ipSeen[canonical] = struct{}{}
				ipAddresses = append(ipAddresses, ip)
			}
			continue
		}
		if _, exists := dnsSeen[value]; !exists {
			dnsSeen[value] = struct{}{}
			dnsNames = append(dnsNames, value)
		}
	}
	return dnsNames, ipAddresses
}

func writeRuntimeFiles(cfg config, pair certificatePair, mode string) error {
	if err := os.MkdirAll(cfg.runtimeDir, 0o750); err != nil {
		return fmt.Errorf("create runtime directory: %w", err)
	}
	if err := os.Chmod(cfg.runtimeDir, 0o750); err != nil {
		return fmt.Errorf("set runtime directory mode: %w", err)
	}
	if err := os.Chown(cfg.runtimeDir, cfg.nginxUID, cfg.nginxGID); err != nil {
		return fmt.Errorf("set runtime directory owner to %d:%d: %w", cfg.nginxUID, cfg.nginxGID, err)
	}

	include := []byte("# hsts=off\n")
	if mode == "user-cert" {
		include = []byte("# hsts=on\nadd_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;\n")
	}

	files := []struct {
		name string
		data []byte
		mode os.FileMode
	}{
		{name: "fullchain.crt", data: pair.certificate, mode: 0o644},
		{name: "tls.key", data: pair.privateKey, mode: 0o600},
		{name: "tls-mode.conf", data: include, mode: 0o644},
	}
	for _, file := range files {
		if err := writeFileAtomically(cfg.runtimeDir, file.name, file.data, file.mode, cfg.nginxUID, cfg.nginxGID); err != nil {
			return err
		}
	}
	return nil
}

func writeFileAtomically(dir, name string, data []byte, mode os.FileMode, uid, gid int) error {
	temp, err := os.CreateTemp(dir, "."+name+"-*")
	if err != nil {
		return fmt.Errorf("create temporary %s: %w", name, err)
	}
	tempPath := temp.Name()
	removeTemp := true
	defer func() {
		if removeTemp {
			_ = os.Remove(tempPath)
		}
	}()

	if _, err := temp.Write(data); err != nil {
		_ = temp.Close()
		return fmt.Errorf("write temporary %s: %w", name, err)
	}
	if err := temp.Sync(); err != nil {
		_ = temp.Close()
		return fmt.Errorf("sync temporary %s: %w", name, err)
	}
	if err := temp.Chmod(mode); err != nil {
		_ = temp.Close()
		return fmt.Errorf("set mode on temporary %s: %w", name, err)
	}
	if err := temp.Chown(uid, gid); err != nil {
		_ = temp.Close()
		return fmt.Errorf("set owner on temporary %s to %d:%d: %w", name, uid, gid, err)
	}
	if err := temp.Close(); err != nil {
		return fmt.Errorf("close temporary %s: %w", name, err)
	}
	if err := os.Rename(tempPath, filepath.Join(dir, name)); err != nil {
		return fmt.Errorf("replace %s: %w", name, err)
	}
	removeTemp = false
	return nil
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
