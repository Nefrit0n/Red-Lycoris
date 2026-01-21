.PHONY: dev prod build clean prune help

# Development mode (with hot-reload via volumes)
dev:
	docker compose up --build

# Production mode (optimized images, no volumes)
prod:
	docker compose -f docker-compose.yml up --build

# Build images without starting
build:
	docker compose build

build-prod:
	docker compose -f docker-compose.yml build

# Stop and remove containers
down:
	docker compose down

# Clean up: remove containers, networks, volumes
clean:
	docker compose down -v --remove-orphans

# Remove dangling images and build cache (reclaim disk space)
prune:
	docker system prune -f
	docker image prune -f

# Deep clean: remove ALL unused images (use with caution)
prune-all:
	docker system prune -af --volumes

# Show disk usage
disk:
	docker system df

help:
	@echo "Available targets:"
	@echo "  dev        - Start in development mode (with hot-reload)"
	@echo "  prod       - Start in production mode (optimized images)"
	@echo "  build      - Build development images"
	@echo "  build-prod - Build production images"
	@echo "  down       - Stop containers"
	@echo "  clean      - Remove containers, networks, volumes"
	@echo "  prune      - Remove dangling images and cache"
	@echo "  prune-all  - Remove ALL unused images (caution!)"
	@echo "  disk       - Show Docker disk usage"
