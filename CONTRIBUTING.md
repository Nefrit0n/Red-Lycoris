# Контрибьютинг

Red Lycoris — мой творческий микро проект, который я разрабатываю один. Если хотите помочь — буду рад, но без обещаний быстрого review и без жёстких процессов.

## Прежде чем писать код

Если планируете что-то значимое — фичу, рефакторинг, изменение API — **сначала откройте issue или discussion** и опишите идею. Я отвечу, вписывается ли это в проект, и подскажу, как сделать проще. Это сэкономит вам время.

Мелочи — опечатки, очевидные баги, фиксы документации — можно сразу PR.

## Поднять локально

```bash
git clone https://github.com/Nefrit0n/Red-Lycoris.git
cd Red-Lycoris
cp env.example .env
make dev
```

Подробнее — в [`README.md`](README.md) и [`docs/deployment.md`](docs/deployment.md).

## Несколько правил по коду

Не для строгости, а чтобы не пришлось переделывать:

- **Backend:** raw SQL через `pgx/v5`, без ORM. Cursor-пагинация, не OFFSET. Без новых зависимостей без обсуждения.
- **Frontend:** TypeScript strict, TanStack Query для серверного стейта, Tailwind, shadcn/ui. UI-текст на русском.
- **Коммиты:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:` и т. д.).
- **DCO:** подписывайте коммиты через `git commit -s` — это подтверждение, что код ваш и вы согласны с лицензией Apache 2.0.

Полные архитектурные принципы — в [`CLAUDE.md`](CLAUDE.md), но это скорее справочник, чем требования к контрибьюторам. Если что-то делаете не так — подскажу в review.

## Pull Requests

- Базовая ветка — `main`.
- Если меняете публичное API — обновите [`backend/api/openapi.yaml`](backend/api/openapi.yaml) и [`CHANGELOG.md`](CHANGELOG.md).
- CI должен быть зелёным.
- Маленькие PR проходят review быстрее.

## Безопасность

Если нашли уязвимость — **не открывайте публичный issue**, см. [`SECURITY.md`](SECURITY.md).

## Всё остальное

Открывайте [discussion](https://github.com/Nefrit0n/Red-Lycoris/discussions). Отвечаю как могу, проект делается в свободное время.