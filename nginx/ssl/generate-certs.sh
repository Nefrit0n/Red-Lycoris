#!/bin/bash
# Generate self-signed SSL certificates for development
# For production, use Let's Encrypt or a proper CA

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="${SCRIPT_DIR}"

# Certificate settings
DAYS_VALID=365
COUNTRY="US"
STATE="State"
CITY="City"
ORG="Lotus-Warden Development"
CN="${SSL_DOMAIN:-localhost}"

# Output files
KEY_FILE="${CERT_DIR}/server.key"
CERT_FILE="${CERT_DIR}/server.crt"
DH_PARAM_FILE="${CERT_DIR}/dhparam.pem"

echo "Generating SSL certificates for: ${CN}"

# Check if certificates already exist
if [[ -f "${KEY_FILE}" && -f "${CERT_FILE}" ]]; then
    echo "Certificates already exist. To regenerate, delete them first:"
    echo "  rm ${KEY_FILE} ${CERT_FILE}"
    exit 0
fi

# Generate private key and self-signed certificate
openssl req -x509 -nodes -days ${DAYS_VALID} -newkey rsa:2048 \
    -keyout "${KEY_FILE}" \
    -out "${CERT_FILE}" \
    -subj "/C=${COUNTRY}/ST=${STATE}/L=${CITY}/O=${ORG}/CN=${CN}" \
    -addext "subjectAltName=DNS:${CN},DNS:*.${CN},IP:127.0.0.1"

# Set proper permissions
chmod 600 "${KEY_FILE}"
chmod 644 "${CERT_FILE}"

echo "Generated:"
echo "  Private key: ${KEY_FILE}"
echo "  Certificate: ${CERT_FILE}"

# Generate DH parameters for better security (optional but recommended)
if [[ ! -f "${DH_PARAM_FILE}" ]]; then
    echo "Generating DH parameters (this may take a while)..."
    openssl dhparam -out "${DH_PARAM_FILE}" 2048
    chmod 644 "${DH_PARAM_FILE}"
    echo "  DH params: ${DH_PARAM_FILE}"
fi

echo ""
echo "Done! For production, replace these with certificates from a trusted CA."
echo ""
echo "To trust this certificate on macOS:"
echo "  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${CERT_FILE}"
echo ""
echo "To trust this certificate on Linux (Debian/Ubuntu):"
echo "  sudo cp ${CERT_FILE} /usr/local/share/ca-certificates/lotus-warden.crt"
echo "  sudo update-ca-certificates"
