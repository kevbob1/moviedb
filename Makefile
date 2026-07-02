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

# Run a command inside the web container. Stack must be up (`make dev`).
# With no args, drops into an interactive shell.
# Examples:
#   make dev-exec                          # shell
#   make dev-exec npm test                 # run Jest
#   make dev-exec npm run check            # full validation
#   make dev-exec npm install motion        # add a dep
#   make dev-exec npx prisma migrate dev   # Prisma ops
dev-exec:    ## Run a command in the web container (or shell if no args). Stack must be up.
	@args="$(filter-out $@,$(MAKECMDGOALS))"; \
	if [ -z "$$args" ]; then \
		docker compose exec web sh; \
	else \
		docker compose exec web $$args; \
	fi

dev-logs:    ## Tail logs
	docker compose logs -f

dev-status:  ## Show dev container state
	docker compose ps

# Catch-all so passthrough args to dev-exec don't error as unknown targets.
%:
	@:
