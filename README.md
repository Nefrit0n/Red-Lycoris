# Local ASOC (MVP)

Локальная платформа для сбора результатов сканеров в одно место, убирает повторы и помогает вести triage.

## Быстрый старт (инфраструктура)
1) Скопируй настройки:
   - cp .env.example .env
2) Подними сервисы:
   - docker compose -f deploy/docker-compose.yml --env-file .env up -d
3) Проверка:
   - Postgres: localhost:5432
   - RabbitMQ UI: http://localhost:15672
   - MinIO Console: http://localhost:9001

## Структура репозитория
- api/     — HTTP API (будет позже)
- worker/  — обработчики (будет позже)
- common/  — общие вещи (модели/хеширование)
- deploy/  — docker-compose и деплой
- docs/    — документация
