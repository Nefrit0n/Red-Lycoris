package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"net"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestCollectSANs(t *testing.T) {
	t.Parallel()

	dnsNames, ipAddresses := collectSANs("asoc.internal, 10.20.30.40;localhost", "redlycoris.internal")
	if want := []string{"localhost", "redlycoris.internal", "asoc.internal"}; !reflect.DeepEqual(dnsNames, want) {
		t.Fatalf("DNS SANs = %v, want %v", dnsNames, want)
	}

	gotIPs := make([]string, 0, len(ipAddresses))
	for _, ip := range ipAddresses {
		gotIPs = append(gotIPs, ip.String())
	}
	if want := []string{"127.0.0.1", "::1", "10.20.30.40"}; !reflect.DeepEqual(gotIPs, want) {
		t.Fatalf("IP SANs = %v, want %v", gotIPs, want)
	}
}

func TestValidateCertificatePair(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, time.June, 12, 12, 0, 0, 0, time.UTC)
	pair, err := generateSelfSigned("asoc.internal", "redlycoris.internal", now)
	if err != nil {
		t.Fatalf("generateSelfSigned() error = %v", err)
	}

	otherKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate mismatched key: %v", err)
	}
	otherKeyDER, err := x509.MarshalPKCS8PrivateKey(otherKey)
	if err != nil {
		t.Fatalf("marshal mismatched key: %v", err)
	}
	mismatchedKey := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: otherKeyDER})

	tests := []struct {
		name       string
		key        []byte
		at         time.Time
		wantErr    string
		wantDNS    string
		wantIP     net.IP
		selfSigned bool
	}{
		{
			name:       "valid self-signed pair",
			key:        pair.privateKey,
			at:         now,
			wantDNS:    "redlycoris.internal",
			wantIP:     net.ParseIP("::1"),
			selfSigned: true,
		},
		{
			name:    "mismatched private key",
			key:     mismatchedKey,
			at:      now,
			wantErr: "tls.key does not match tls.crt",
		},
		{
			name:    "expired certificate",
			key:     pair.privateKey,
			at:      now.Add(826 * 24 * time.Hour),
			wantErr: "certificate expired",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cert, _, err := validateCertificatePair(pair.certificate, tt.key, tt.at)
			if tt.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("validateCertificatePair() error = %v, want substring %q", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("validateCertificatePair() error = %v", err)
			}
			if err := cert.VerifyHostname(tt.wantDNS); err != nil {
				t.Fatalf("VerifyHostname(%q): %v", tt.wantDNS, err)
			}
			if err := cert.VerifyHostname(tt.wantIP.String()); err != nil {
				t.Fatalf("VerifyHostname(%q): %v", tt.wantIP, err)
			}
			if tt.selfSigned && !isSelfSigned(cert) {
				t.Fatal("certificate is not self-signed")
			}
		})
	}
}
