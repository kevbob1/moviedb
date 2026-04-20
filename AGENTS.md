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
  - Run all: `bundle exec rspec`
  - Run file: `bundle exec rspec spec/path/to/file_spec.rb`
- **Patterns**: Mock external APIs (TMDB) and Kafka where possible using existing support in `spec/support/`.

## Linting
- **Command**: `bundle exec rubocop`
- **Focus**: Run on changed files only for speed.

## Deployment (K8s/Helm)
- **Full Guide**: See `DEPLOY.md`.
- **Secrets**: Managed via `sops` and `helm-secrets`. Requires `SOPS_AGE_KEY_FILE`.
- **Commands**:
  - Minikube: `helm secrets upgrade --install moviedb ./chart -f chart/values.yaml -f chart/values.minikube.yaml -f chart/secrets.yaml`
  - Kafka: `helm secrets upgrade --install kafka ./charts/kafka -n database -f charts/kafka/values.yaml -f charts/kafka/secrets.yaml`
- **Migrations**: Run automatically via Helm `pre-install`/`pre-upgrade` hooks.

## Guidelines
1. **Migrations**: Always generate migrations for DB changes. Do not edit `schema.rb` directly.
2. **Kafka**: Ensure Kafka consumers are idempotent or handle duplicates appropriately.
3. **Audit**: Maintain the audit trail in `Movie` model callbacks.
