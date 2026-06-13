# Сетевые требования RedLycoris

Документ для согласования сетевых доступов при on-prem развёртывании в закрытом контуре.

## Исходящие соединения (backend -> внешние источники)

Ниже перечислены URL, найденные по коду `backend/internal/enrichment/`.

| Источник | Домен | Порт | Назначение | Обязателен |
|---|---|---:|---|---|
| NVD CVE API | `services.nvd.nist.gov` | 443 | Синхронизация CVE/CVSS и связанных данных NVD | Да (для NVD enrichment) |
| NVD CPE API | `services.nvd.nist.gov` | 443 | Синхронизация словаря CPE | Да (для CPE enrichment) |
| EPSS | `epss.cyentia.com` | 443 | Загрузка ежедневных EPSS score | Да (для EPSS enrichment) |
| CISA KEV | `www.cisa.gov` | 443 | Получение каталога KEV | Да (для KEV enrichment) |
| БДУ ФСТЭК | `bdu.fstec.ru` | 443 | Загрузка XML-выгрузки БДУ | Да (для BDU enrichment) |
| OSV | `osv-vulnerabilities.storage.googleapis.com` | 443 | Загрузка архивов OSV по экосистемам | Да (для OSV enrichment) |
| CWE | `cwe.mitre.org` | 443 | Загрузка CWE каталога | Да (для CWE enrichment) |

> Если в вашей установке enrichment отключён (`ENRICHMENT_ENABLED=false`), внешние исходящие соединения не требуются для базовой работы импорта/хранения findings.

## Если внешний доступ невозможен

1. Отключите enrichment: `ENRICHMENT_ENABLED=false`.
2. Рассмотрите зеркалирование источников во внутренний репозиторий артефактов.
3. При наличии внутреннего зеркала обновите URL в sync-модулях enrichment (этап кастомизации).
4. Зафиксируйте SLA по актуализации зеркал (например, EPSS ежедневно, KEV каждые 6 часов).

## HTTP-прокси

Для выхода через корпоративный прокси задайте переменные окружения backend-сервиса:

- `HTTPS_PROXY=http://proxy.company.local:3128`
- `NO_PROXY=localhost,127.0.0.1,postgres,redis,backend,frontend`

Рекомендуется также добавить в `NO_PROXY` внутренние домены/подсети вашего кластера (например, `.svc,.cluster.local,10.0.0.0/8`).

## Входящие соединения

| Компонент | Порт | Откуда должен быть доступ |
|---|---:|---|
| Frontend (development HTTP) | `3000/tcp` | Рабочие места разработчиков |
| Frontend (production HTTPS) | `443/tcp` | Рабочие места пользователей |
| Frontend (production redirect) | `80/tcp` | Рабочие места пользователей; только перенаправление на HTTPS |
| Backend API | `8080/tcp` | Frontend, администраторы/интеграции |
| PostgreSQL | `5432/tcp` | Только backend (внутрисетевой доступ) |
| Redis | `6379/tcp` | Только backend (внутрисетевой доступ) |

## Чек-лист для закрытого контура

- [ ] Подтверждён список исходящих доменов для enrichment.
- [ ] Открыт порт 443/TCP до нужных доменов **или** enrichment отключён.
- [ ] Настроен `HTTPS_PROXY`/`NO_PROXY` (если требуется).
- [ ] Ограничены входящие порты PostgreSQL/Redis только внутренним контуром.
- [ ] Проверен `GET /health` после запуска.
- [ ] Задокументирован процесс обновления источников (прямой интернет или внутреннее зеркало).
