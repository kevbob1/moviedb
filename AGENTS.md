# Project: MovieDB (Rails 7 + Kafka)

## Development & Efficiency (Token Saving)
- **File Exploration**: Use `ls -R` to understand structure. Use `grep` or `rg` to find definitions. Avoid `read` on entire files if you only need a snippet.
- **Minimal Context**: Do not read `Gemfile.lock`, `schema.rb`, or large log files unless debugging dependencies or migrations specifically.
- **Precise Edits**: Keep `oldText` as small as possible. Avoid including large unchanged blocks.

## Architecture
- **Web**: Rails 7 (MVC), Tailwind CSS, Hotwire/Stimulus.
- **Kafka**:
  - Producers/Consumers in `app/services/`.
  - Initializer: `config/initializers/kafka.rb`.
  - Task: `lib/tasks/kafka.rake`.
  - Movies publish audit events on CRUD operations via `MovieAuditService`.
- **Services**: External APIs (TMDB) and Kafka logic live in `app/services/`.

## Testing
- **Suite**: RSpec.
- **Commands**:
  - Run all: `devcontainer exec bundle exec rspec`
  - Run file: `devcontainer exec bundle exec rspec spec/path/to/file_spec.rb`
- **Patterns**: Mock external APIs (TMDB) and Kafka where possible using existing support in `spec/support/`.

## Linting
- **Command**: `devcontainer exec bundle exec rubocop`
- **Focus**: Run on changed files only for speed.

## Deployment (K8s/Helm)
- **Full Guide**: See `DEPLOY.md`.
- **Secrets**: Managed via `sops` and `helm-secrets`. Requires `SOPS_AGE_KEY_FILE`.
- **Commands**:
  - Kafka: `helm secrets upgrade --install kafka ./charts/kafka -n database -f charts/kafka/values.yaml`
  - MovieDB: `helm secrets upgrade --install moviedb ./charts/moviedb -f charts/moviedb/values.yaml -f charts/moviedb/values-secrets.yaml`
- **Migrations**: Run automatically via Helm `pre-install`/`pre-upgrade` hooks.

## Guidelines
1. **Migrations**: Always generate migrations for DB changes. Do not edit `schema.rb` directly.
2. **Kafka**: Ensure Kafka consumers are idempotent or handle duplicates appropriately.
3. **Audit**: Maintain the audit trail in `Movie` model callbacks.
4. **DevContainer**: All `rspec`, `rake`, `rails`, and `bundle` commands must be executed via the devcontainer CLI: `devcontainer exec <command>`.
