# SSL Certificate Setup

This directory contains SSL certificates for HTTPS support.

## Development (Self-Signed Certificates)

For local development, generate self-signed certificates:

```bash
# Generate certificates
./generate-certs.sh

# Or with custom domain
SSL_DOMAIN=myapp.local ./generate-certs.sh
```

This will create:
- `server.key` - Private key (keep secret!)
- `server.crt` - SSL certificate
- `dhparam.pem` - DH parameters (optional, for better security)

### Trusting Self-Signed Certificates

**macOS:**
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain server.crt
```

**Linux (Debian/Ubuntu):**
```bash
sudo cp server.crt /usr/local/share/ca-certificates/lotus-warden.crt
sudo update-ca-certificates
```

**Windows:**
1. Double-click on `server.crt`
2. Click "Install Certificate"
3. Select "Local Machine"
4. Select "Place all certificates in the following store"
5. Browse and select "Trusted Root Certification Authorities"
6. Click "Finish"

**Browser (Chrome/Firefox):**
Most browsers will show a warning for self-signed certificates. You can:
1. Click "Advanced" → "Proceed to localhost (unsafe)"
2. Or import the certificate into browser's certificate store

## Production (Let's Encrypt / Real CA)

For production, use certificates from a trusted Certificate Authority:

### Option 1: Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./server.crt
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./server.key
```

### Option 2: Commercial CA

Purchase a certificate from a CA (DigiCert, Comodo, etc.) and place:
- Certificate chain → `server.crt`
- Private key → `server.key`

## File Permissions

Ensure proper permissions:
```bash
chmod 600 server.key   # Private key - owner read/write only
chmod 644 server.crt   # Certificate - readable by all
chmod 644 dhparam.pem  # DH params - readable by all
```

## Docker Compose

Certificates are mounted from this directory via docker-compose.yml:
```yaml
volumes:
  - ./nginx/ssl/server.crt:/etc/nginx/ssl/server.crt:ro
  - ./nginx/ssl/server.key:/etc/nginx/ssl/server.key:ro
```

## Security Notes

- **Never commit** `server.key` to version control
- The `.gitignore` in this directory ignores all `.key`, `.crt`, and `.pem` files
- Rotate certificates regularly (Let's Encrypt: 90 days, others: 1-2 years)
- For production, enable OCSP stapling in nginx config
