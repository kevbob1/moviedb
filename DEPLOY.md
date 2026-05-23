# Deployment

## Prerequisites

Required tooling:

- Helm `>= 3.12`
- `helm-secrets` plugin `v4.7.5` (jkroepke fork)
- `sops`
- `age`

Install commands:

```sh
brew install helm sops age
helm plugin install https://github.com/jkroepke/helm-secrets --version v4.7.5
helm version
helm secrets --version
sops --version
age --version
```

## Secret Management Workflow

Generate an AGE key pair:

```sh
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
```

Get the public key and add it to `.sops.yaml`:

```sh
age-keygen -y ~/.config/sops/age/keys.txt
```

Update `.sops.yaml` so the AGE creation rule includes that public key.

Then populate `charts/moviedb/secrets.yaml` with app values:

```yaml
secrets:
  database:
    password: <postgres password>
  rails:
    master_key: <contents of config/master.key>
    secret_key_base: <64-byte hex string>
```

Deploy with the AGE private key available via `SOPS_AGE_KEY_FILE`. `helm-secrets` handles decryption automatically during the Helm run.

```sh
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"
```

## Production Deploy

To retrieve the PostgreSQL password:

```sh
kubectl get secret --namespace database postgres-postgresql -o jsonpath="{.data.postgres-password}" | base64 -d
```

### 2. Deploy MovieDB
```sh
helm upgrade --install moviedb ./helm/moviedb -f helm/moviedb/values.yaml -f secrets://helm/moviedb/values-secrets.yaml --set image.tag=1.16
```

## Migration Behavior

Database migrations run in a `pre-install` / `pre-upgrade` hook Job before the app is updated.

- `backoffLimit: 0` so failures are immediate and not retried
- `activeDeadlineSeconds: 120` to cap migration runtime
- `restartPolicy: Never`

The app Deployment also has an init container that polls `rake db:abort_if_pending_migrations` as a guard before starting the web container. The migration command uses `db:prepare`, which is idempotent and safe to run repeatedly.

## Rollback Notes

List release revisions:

```sh
helm history moviedb
```

Rollback to a previous revision:

```sh
helm rollback moviedb [REVISION]
```

A rollback triggers `pre-upgrade` hooks again, so the migration Job runs on rollback as well. That is safe because `db:prepare` is idempotent.
