COMPOSE = docker compose -f deploy/docker-compose.yml --env-file .env

.PHONY: up down logs ps

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=200

ps:
	$(COMPOSE) ps
