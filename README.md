# Red Lycoris

[![Go](https://img.shields.io/badge/Go-1.25-00ADD8?style=flat-square&logo=go)](backend/go.mod) [![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](frontend/package.json) [![License](https://img.shields.io/badge/License-Apache--2.0-blue?style=flat-square)](LICENSE)

On-premise ASOC-платформа: принимает результаты сканеров, дедуплицирует, обогащает и приоритизирует находки. Она не запускает сканеры и не является ASMP.

```bash
cp env.example .env
# Задайте BOOTSTRAP_ADMIN_PASSWORD в .env
docker compose up --build -d
docker compose ps
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
# Откройте frontend по адресу FRONTEND_PORT из .env
docker compose logs -f backend
```

[Быстрый старт: от установки до первой находки](https://github.com/Nefrit0n/Red-Lycoris/wiki/Быстрый-старт-Требования).

Полная документация: [GitHub Wiki](https://github.com/Nefrit0n/Red-Lycoris/wiki). Изменения Wiki вносятся в [`wiki/`](wiki/README.md), не через веб-интерфейс GitHub Wiki.
