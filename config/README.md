# Config

Deployment assets live in this directory.

## WSGI/ASGI servers

- `config/gunicorn.conf.py`: Gunicorn defaults
  - **Workers:** 2 (override with `GUNICORN_WORKERS`)
  - **Threads:** 4 (override with `GUNICORN_THREADS`)
  - Optional auto sizing: set `GUNICORN_WORKERS_AUTO=true`
- `config/uwsgi.ini`: uWSGI defaults
  - **Processes:** 2
  - **Threads:** 4

## NGINX

- `config/nginx/lotus_warden.conf`: serves `/static/` from `/app/staticfiles/` and proxies to the Gunicorn socket.

## Deployment scripts

- `scripts/deploy-backend.sh`: migrate, collect static, start Gunicorn (WSGI).
- `scripts/deploy-asgi.sh`: migrate, collect static, start Gunicorn with Uvicorn worker (ASGI).
- `scripts/deploy-nginx.sh`: copy NGINX config and reload.
- `scripts/load-test.sh`: run a quick load check using `hey` (local or Docker).

Example load test:

```bash
./scripts/load-test.sh http://localhost/health/
```
