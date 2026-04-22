# Модель безопасности RedLycoris

## Что платформа защищает

- **Данные о уязвимостях** — findings, enrichment data, priority scores
- **Историю изменений** — audit log с diff всех операций
- **Доступ к данным** — RBAC с ролями на уровне проекта
- **Сессии** — cookie `rl_session` с флагами Secure + HttpOnly + SameSite=Strict
- **API** — аутентификация по сессии или API-токену per project

## Что платформа НЕ защищает

- **Сетевой периметр** — ограничение сетевого доступа к портам 8080/3000 лежит на инфраструктуре (firewall, VPC, nginx)
- **Хранение учётных данных интеграций** — если вы добавите интеграцию с Jira/GitLab, учётные данные должны храниться в vault (Vault, AWS Secrets Manager), не в `.env`
- **Supply chain backend** — образы из Docker Hub/GCR; в air-gapped среде необходимо зеркало образов
- **Данные сканеров до импорта** — файлы в транзите до `POST /api/v1/import` (SARIF, JSON) не шифруются платформой
- **Физическую безопасность** хоста, где запущены контейнеры

## Аутентификация

| Механизм | Применение |
|----------|-----------|
| Cookie-сессия (`rl_session`) | Браузерный UI |
| Bearer API-токен | CI/CD, сканеры, скрипты |
| Bootstrap admin | Первый пользователь при пустой БД |

**Rate limiting на `/api/v1/auth/login`:** 5 попыток / 15 минут на пару IP+email. При превышении — HTTP 429 + `Retry-After`.

Пароли хранятся в виде bcrypt-хешей.

## Авторизация (RBAC)

| Роль | Права |
|------|-------|
| `viewer` | Просмотр findings и проектов |
| `triager` | Изменение статуса, назначение, импорт |
| `project_admin` | Управление членами, токены, настройки проекта |
| `global_admin` | Все права + управление пользователями + просмотр audit log |

Роль назначается на уровне проекта. Один пользователь может иметь разные роли в разных проектах.

## Cookie

```
Set-Cookie: rl_session=<opaque_token>; HttpOnly; Secure; SameSite=Strict; Path=/
```

- `HttpOnly` — недоступна JavaScript
- `Secure` — только по HTTPS (включается при `COOKIE_SECURE=true` или `ENV != dev`)
- `SameSite=Strict` — защита от CSRF

## Логирование и PII

- В логах **не содержится** значений паролей, токенов, cookies
- Email пользователя может присутствовать в audit log (это намеренно — для расследований)
- Structured JSON logging через `slog`; при `LOG_LEVEL=warn` в production большинство info-событий не пишется

## Известные ограничения (0.1.0b)

- Нет встроенного TLS-termination (должен делать reverse proxy — nginx/Traefik)
- Нет MFA/2FA
- Нет IP-allowlist для admin-эндпоинтов
- Нет ротации API-токенов по расписанию

## Рекомендации по production-развёртыванию

### Сетевая изоляция

```
Internet → [Firewall] → nginx (TLS, 443) → frontend (3000/8080)
                                          → backend (8080) ─── postgres (5432, internal only)
                                                             └── redis (6379, internal only)
```

Postgres и Redis **не должны** быть доступны извне контейнерной сети. Production compose (`deployments/docker-compose.prod.yml`) убирает их ports-маппинг.

### Рекомендуемые дополнительные меры

1. **TLS на nginx** — `ssl_protocols TLSv1.2 TLSv1.3`, HSTS
2. **Смените дефолтные пароли** — `POSTGRES_PASSWORD` и bootstrap admin password не должны быть значениями из `env.example`
3. **`COOKIE_SECURE=true`** — обязательно при работе через HTTPS
4. **`TRUST_PROXY=true`** — только если за доверенным reverse proxy; иначе X-Forwarded-For можно подменить
5. **Ограничьте CORS** — задайте `CORS_ORIGINS` явно, не используйте wildcard
6. **Изолируйте backend и БД** в отдельную network/VPC от frontend
7. **Регулярный backup** PostgreSQL — см. [docs/ops/backup-restore.md](ops/backup-restore.md)
8. **Аудит логов** — `/api/v1/admin/audit` доступен только Global Admin

### Контейнерная безопасность

- Backend запускается от non-root пользователя `app` (uid 1000)
- Frontend nginx запускается от uid 101
- Образы на alpine/stable-alpine — минимальный attack surface
- `CGO_ENABLED=0` — статически слинкованный бинарь без C-зависимостей рантайма
