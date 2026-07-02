.PHONY: help dev dev-build dev-rebuild dev-down dev-reset dev-exec dev-logs dev-status

.DEFAULT_GOAL := help

help:        ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "; printf "Targets:\n"} {printf "  %-15s %s\n", $$1, $$2}'

dev:         ## Start dev stack (web + postgres)
	docker compose up

dev-build:   ## Build dev images (cached layers)
	docker compose build

dev-rebuild: ## Rebuild dev images from scratch (fresh npm install)
	docker compose build --no-cache

dev-down:    ## Stop stack, keep volumes
	docker compose down

dev-reset:   ## Stop stack, drop pg-data volume (fresh DB)
	docker compose down -v

dev-exec:    ## Exec interactive shell into web container
	docker compose exec web sh

dev-logs:    ## Tail logs
	docker compose logs -f

dev-status:  ## Show dev container state
	docker compose ps
