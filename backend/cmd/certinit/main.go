package main

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"log/slog"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	defaultTLSDir    = "/etc/redlycoris/tls"
	defaultCustomDir = "/etc/redlycoris/tls-custom"
	nginxUID         = 101
	certValidity     = 825 * 24 * time.Hour
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))

	tlsDir := getEnv("RL_TLS_DIR", defaultTLSDir)
	customDir := getEnv("RL_TLS_CUSTOM_DIR", defaultCustomDir)
	hostname := getEnv("RL_HOSTNAME", "")
	sansEnv := getEnv("RL_TLS_SANS", "")

	if err := run(log, tlsDir, customDir, hostname, sansEnv); err != nil {
		log.Error("certinit failed", "err", err)
		os.Exit(1)
	}
	log.Info("certinit completed successfully")
}

func run(log *slog.Logger, tlsDir, customDir, hostname, sansEnv string) error {
	if err := os.MkdirAll(tlsDir, 0755); err != nil {
		return fmt.Errorf("create tls dir %q: %w", tlsDir, err)
	}

	customKeyPath := filepath.Join(customDir, "tls.key")
	customCertPath := filepath.Join(customDir, "tls.crt")
	customCAPath := filepath.Join(customDir, "ca.crt")

	runtimeKeyPath := filepath.Join(tlsDir, "tls.key")
	runtimeCertPath := filepath.Join(tlsDir, "fullchain.crt")
	snippetPath := filepath.Join(tlsDir, "nginx-tls-snippet.conf")

	hasCustomKey := fileExists(customKeyPath)
	hasCustomCert := fileExists(customCertPath)

	userCertMode := false

	if hasCustomKey || hasCustomCert {
		// User placed at least one file — both must be present.
		if !hasCustomKey {
			return fmt.Errorf("tls.crt found in %s but tls.key is missing", customDir)
		}
		if !hasCustomCert {
			return fmt.Errorf("tls.key found in %s but tls.crt is missing", customDir)
		}

		keyPEM, err := os.ReadFile(customKeyPath)
		if err != nil {
			return fmt.Errorf("read tls.key: %w", err)
		}
		certPEM, err := os.ReadFile(customCertPath)
		if err != nil {
			return fmt.Errorf("read tls.crt: %w", err)
		}

		if err := validateKeyAndCert(keyPEM, certPEM); err != nil {
			return fmt.Errorf("custom certificate validation failed: %w", err)
		}

		log.Info("using user-provided TLS certificate", "cert", customCertPath)

		// Build fullchain: leaf cert + optional CA chain.
		fullchain := bytes.TrimRight(certPEM, "\n")
		fullchain = append(fullchain, '\n')
		if fileExists(customCAPath) {
			caData, err := os.ReadFile(customCAPath)
			if err != nil {
				return fmt.Errorf("read ca.crt: %w", err)
			}
			fullchain = append(fullchain, caData...)
		}

		if err := writeFile(runtimeCertPath, fullchain, 0644); err != nil {
			return err
		}
		if err := writeFile(runtimeKeyPath, keyPEM, 0600); err != nil {
			return err
		}
		if err := os.Chown(runtimeKeyPath, nginxUID, nginxUID); err != nil {
			return fmt.Errorf("chown tls.key to uid %d (certinit must run as root): %w", nginxUID, err)
		}

		userCertMode = true
	} else {
		log.Info("no custom certificates found, entering self-signed mode", "custom_dir", customDir)

		if needsRegeneration(runtimeCertPath, runtimeKeyPath, log) {
			sans := buildSANs(hostname, sansEnv)
			log.Info("generating self-signed ECDSA P-256 certificate", "sans", sans)
			if err := generateSelfSigned(runtimeKeyPath, runtimeCertPath, sans); err != nil {
				return fmt.Errorf("generate self-signed certificate: %w", err)
			}
			if err := os.Chown(runtimeKeyPath, nginxUID, nginxUID); err != nil {
				return fmt.Errorf("chown tls.key to uid %d (certinit must run as root): %w", nginxUID, err)
			}
			log.Info("self-signed certificate written", "cert", runtimeCertPath)
		} else {
			log.Info("existing self-signed certificate is valid, skipping regeneration")
		}
	}

	snippet := buildNginxSnippet(runtimeCertPath, runtimeKeyPath, userCertMode)
	if err := writeFile(snippetPath, []byte(snippet), 0644); err != nil {
		return err
	}

	// Write the nginx server-blocks config that nginx picks up via a wildcard include.
	// Lives in conf.d/ within the runtime volume so the glob in nginx.conf finds it
	// only when the volume is mounted (i.e., in prod), leaving dev unaffected.
	serverConfDir := filepath.Join(tlsDir, "conf.d")
	if err := os.MkdirAll(serverConfDir, 0755); err != nil {
		return fmt.Errorf("create tls conf.d: %w", err)
	}
	serverConf := buildNginxServerConf(snippetPath)
	if err := writeFile(filepath.Join(serverConfDir, "tls-server.conf"), []byte(serverConf), 0644); err != nil {
		return err
	}

	log.Info("TLS bootstrap complete",
		"mode", map[bool]string{true: "user-cert", false: "self-signed"}[userCertMode],
		"dir", tlsDir,
	)
	return nil
}

// validateKeyAndCert parses and cross-validates a PEM-encoded private key and certificate.
// Supports ECDSA and RSA keys (PKCS1, PKCS8, SEC1 encoding).
func validateKeyAndCert(keyPEM, certPEM []byte) error {
	keyBlock, _ := pem.Decode(keyPEM)
	if keyBlock == nil {
		return fmt.Errorf("no PEM block found in tls.key")
	}

	var keyPub interface{}
	switch keyBlock.Type {
	case "EC PRIVATE KEY":
		k, err := x509.ParseECPrivateKey(keyBlock.Bytes)
		if err != nil {
			return fmt.Errorf("parse EC private key: %w", err)
		}
		keyPub = &k.PublicKey
	case "RSA PRIVATE KEY":
		k, err := x509.ParsePKCS1PrivateKey(keyBlock.Bytes)
		if err != nil {
			return fmt.Errorf("parse RSA PKCS1 private key: %w", err)
		}
		keyPub = &k.PublicKey
	case "PRIVATE KEY":
		k, err := x509.ParsePKCS8PrivateKey(keyBlock.Bytes)
		if err != nil {
			return fmt.Errorf("parse PKCS8 private key: %w", err)
		}
		keyPub = extractPublicKey(k)
		if keyPub == nil {
			return fmt.Errorf("unsupported key algorithm in PKCS8 block")
		}
	default:
		return fmt.Errorf("unsupported PEM key type %q in tls.key", keyBlock.Type)
	}

	certBlock, _ := pem.Decode(certPEM)
	if certBlock == nil {
		return fmt.Errorf("no PEM block found in tls.crt")
	}
	if certBlock.Type != "CERTIFICATE" {
		return fmt.Errorf("expected CERTIFICATE PEM block in tls.crt, got %q", certBlock.Type)
	}
	cert, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return fmt.Errorf("parse certificate: %w", err)
	}

	now := time.Now()
	if now.After(cert.NotAfter) {
		return fmt.Errorf("certificate expired on %s", cert.NotAfter.UTC().Format(time.RFC3339))
	}
	if now.Before(cert.NotBefore) {
		return fmt.Errorf("certificate not valid before %s", cert.NotBefore.UTC().Format(time.RFC3339))
	}

	if !publicKeysMatch(keyPub, cert.PublicKey) {
		return fmt.Errorf("tls.key does not match the public key in tls.crt")
	}

	return nil
}

func extractPublicKey(priv interface{}) interface{} {
	switch k := priv.(type) {
	case *ecdsa.PrivateKey:
		return &k.PublicKey
	case *rsa.PrivateKey:
		return &k.PublicKey
	default:
		return nil
	}
}

func publicKeysMatch(a, b interface{}) bool {
	switch ak := a.(type) {
	case *ecdsa.PublicKey:
		bk, ok := b.(*ecdsa.PublicKey)
		if !ok {
			return false
		}
		return ak.X.Cmp(bk.X) == 0 && ak.Y.Cmp(bk.Y) == 0
	case *rsa.PublicKey:
		bk, ok := b.(*rsa.PublicKey)
		if !ok {
			return false
		}
		return ak.N.Cmp(bk.N) == 0 && ak.E == bk.E
	default:
		return false
	}
}

func needsRegeneration(certPath, keyPath string, log *slog.Logger) bool {
	if !fileExists(certPath) || !fileExists(keyPath) {
		return true
	}
	data, err := os.ReadFile(certPath)
	if err != nil {
		log.Warn("cannot read existing certificate, will regenerate", "err", err)
		return true
	}
	block, _ := pem.Decode(data)
	if block == nil {
		log.Warn("cannot parse existing certificate PEM, will regenerate")
		return true
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		log.Warn("cannot parse existing certificate, will regenerate", "err", err)
		return true
	}
	if time.Now().After(cert.NotAfter) {
		log.Info("existing self-signed certificate has expired, regenerating", "expired_at", cert.NotAfter.UTC().Format(time.RFC3339))
		return true
	}
	return false
}

func generateSelfSigned(keyPath, certPath string, sans []string) error {
	privKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return fmt.Errorf("generate ECDSA key: %w", err)
	}

	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return fmt.Errorf("generate serial number: %w", err)
	}

	now := time.Now()
	tmpl := &x509.Certificate{
		SerialNumber: serial,
		Subject: pkix.Name{
			Organization: []string{"Red Lycoris"},
			CommonName:   "Red Lycoris Self-Signed",
		},
		// Small back-date to tolerate minor clock skew on the client side.
		NotBefore:             now.Add(-5 * time.Minute),
		NotAfter:              now.Add(certValidity),
		KeyUsage:              x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}

	for _, san := range sans {
		if ip := net.ParseIP(san); ip != nil {
			tmpl.IPAddresses = append(tmpl.IPAddresses, ip)
		} else {
			tmpl.DNSNames = append(tmpl.DNSNames, san)
		}
	}

	certDER, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &privKey.PublicKey, privKey)
	if err != nil {
		return fmt.Errorf("create certificate: %w", err)
	}

	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})
	if err := writeFile(certPath, certPEM, 0644); err != nil {
		return err
	}

	keyBytes, err := x509.MarshalECPrivateKey(privKey)
	if err != nil {
		return fmt.Errorf("marshal EC private key: %w", err)
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyBytes})
	if err := writeFile(keyPath, keyPEM, 0600); err != nil {
		return err
	}

	return nil
}

func buildSANs(hostname, sansEnv string) []string {
	seen := make(map[string]bool)
	var result []string

	add := func(s string) {
		s = strings.TrimSpace(s)
		if s != "" && !seen[s] {
			seen[s] = true
			result = append(result, s)
		}
	}

	add("localhost")
	add("127.0.0.1")
	add("::1")

	if hostname != "" {
		add(hostname)
	}
	for _, s := range strings.Split(sansEnv, ",") {
		add(s)
	}

	return result
}

// buildNginxServerConf generates the complete nginx server-blocks config for TLS.
// The 80→443 redirect server and the HTTPS server are both included.
// The ssl_certificate directives and the optional HSTS header are in the snippet
// file that certinit also writes (included via a literal path inside this config).
func buildNginxServerConf(snippetPath string) string {
	return fmt.Sprintf(`# Generated by certinit — do not edit manually.
server {
    listen 80;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;

    include %s;

    ssl_protocols         TLSv1.2 TLSv1.3;
    ssl_ciphers           ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout   1d;
    ssl_session_cache     shared:MozSSL:10m;
    ssl_session_tickets   off;
    ssl_stapling          off;

    root  /usr/share/nginx/html;
    index index.html;

    resolver 127.0.0.11 ipv6=off;
    set $backend_upstream backend:8080;

    location /api/ {
        proxy_pass http://$backend_upstream;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
`, snippetPath)
}

func buildNginxSnippet(certPath, keyPath string, hsts bool) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "ssl_certificate     %s;\n", certPath)
	fmt.Fprintf(&sb, "ssl_certificate_key %s;\n", keyPath)
	if hsts {
		fmt.Fprintf(&sb, "add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;\n")
	}
	return sb.String()
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func writeFile(path string, data []byte, mode os.FileMode) error {
	if err := os.WriteFile(path, data, mode); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	return nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
