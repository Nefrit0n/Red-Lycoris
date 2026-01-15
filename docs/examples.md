# API Examples

## Health

```bash
curl http://localhost:8080/health
```

## List products

```bash
curl http://localhost:8080/v1/products
```

## Upload scan

```bash
curl -X POST http://localhost:8081/v1/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "11111111-1111-1111-1111-111111111111",
    "product": "Payments API",
    "tool": "trivy",
    "report": "base64-encoded-report"
  }'
```
