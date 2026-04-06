.PHONY: dev prod migrate seed sync logs clean stop build test help

COMPOSE := docker compose
COMPOSE_PROD := $(COMPOSE) -f docker-compose.yml -f docker-compose.prod.yml

## ── Development ───────────────────────────────

dev: ## Запуск в dev режиме (Vite hot reload, все порты открыты)
	$(COMPOSE) up --build

dev-d: ## Запуск в dev режиме (фоновый)
	$(COMPOSE) up --build -d

## ── Production ────────────────────────────────

prod: ## Запуск в production (nginx, только API порт наружу)
	$(COMPOSE_PROD) up --build -d

prod-down: ## Остановка production
	$(COMPOSE_PROD) down

## ── Database ──────────────────────────────────

migrate: ## Запуск миграций (через backend контейнер)
	$(COMPOSE) exec backend ./vulnscope

seed: ## Генерация тестовых данных (100k findings)
	cd backend && go build -o /tmp/redlycoris-seed ./cmd/seed && /tmp/redlycoris-seed

## ── Enrichment ────────────────────────────────

sync: ## Ручной запуск всех синхронизаций обогащения
	@for src in nvd epss kev bdu osv cwe cpe; do \
		echo "Syncing $$src..."; \
		curl -s -X POST http://localhost:$${API_PORT:-8080}/api/v1/enrichment/sync/$$src; \
		echo ""; \
	done

## ── Observability ─────────────────────────────

logs: ## Логи всех сервисов (follow)
	$(COMPOSE) logs -f

logs-api: ## Логи только backend
	$(COMPOSE) logs -f backend

ps: ## Статус сервисов
	$(COMPOSE) ps

## ── Cleanup ───────────────────────────────────

stop: ## Остановка всех сервисов (данные сохраняются)
	$(COMPOSE) down

clean: ## Остановка + удаление volumes (все данные будут потеряны!)
	$(COMPOSE) down -v

## ── Build ─────────────────────────────────────

build: ## Сборка всех образов без запуска
	$(COMPOSE) build

build-prod: ## Сборка production образов
	$(COMPOSE_PROD) build

## ── Help ──────────────────────────────────────

help: ## Показать список команд
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
