# Dev/prod rate-limiting notes

## Overview

NGINX now distinguishes read-heavy and write-heavy API traffic:

- **api_read**: `/api/v1/findings` (list + detail + neighbors), `/api/v1/products`, `/api/v1/import-jobs`, `/api/v1/sbom`.
- **api_write**: mutating endpoints such as bulk updates and comments, plus the remaining `/api/v1/` routes.

Rate limiting returns **429** with a `Retry-After: 1` header. In development (`docker-compose.override.yml`), the same rules apply but with much higher limits to avoid throttling local workflows.

## How to run

```bash
docker compose up
```

Optional: trigger rate limiting intentionally (prod settings) to see 429 responses:

```bash
while true; do curl -sk -o /dev/null -w "%{http_code}\n" https://localhost/api/v1/findings; done
```

## Verification checklist

- Open `/findings`, click items rapidly, open the drawer, open a detail page in a new tab.
- Confirm the detail view never stays blank (it should retry on 429/503 with a short backoff).
- If you intentionally spam requests, confirm NGINX responds with **429** (not 503) and includes `Retry-After`.
- Confirm backend services still receive traffic normally (no change in request paths or payloads).
