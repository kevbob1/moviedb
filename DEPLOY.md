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

Update `.sops.yaml` so the AGE creation rule includes that public key, then populate `chart/secrets.yaml` with real values:

```yaml
secrets:
  database:
    password: <postgres password>
  kafka:
    username: <kafka SCRAM username>
    password: <kafka SCRAM password>
    cluster_id: <base64 UUID — generate with kafka-storage.sh random-uuid>
  rails:
    master_key: <contents of config/master.key>
    secret_key_base: <64-byte hex string>
```

Encrypt the file in place:

```sh
sops --encrypt --in-place chart/secrets.yaml
```

Deploy with the AGE private key available via `SOPS_AGE_KEY_FILE`. `helm-secrets` handles decryption automatically during the Helm run.

```sh
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"
```

## Production Deploy

```sh
helm secrets upgrade --install moviedb ./chart -f chart/values.yaml -f chart/secrets.yaml
```

## Minikube Deploy

Use the same command with the Minikube override file:

```sh
helm secrets upgrade --install moviedb ./chart -f chart/values.yaml -f chart/values.minikube.yaml -f chart/secrets.yaml
```

`chart/values.minikube.yaml` overrides:

- Ingress host to `moviedb.local`
- Kafka resource requests/limits reduced for local cluster capacity

## Migration Behavior

Database migrations run in a `pre-install` / `pre-upgrade` hook Job before the app is updated.

- `backoffLimit: 0` so failures are immediate and not retried
- `activeDeadlineSeconds: 120` to cap migration runtime
- `restartPolicy: Never`

The app Deployment also has an init container that polls `rake db:abort_if_pending_migrations` as a guard before starting the web container. The migration command uses `db:prepare`, which is idempotent and safe to run repeatedly.

## Kafka `CLUSTER_ID`

Generate the Kafka cluster ID once before first deploy:

```sh
docker run --rm apache/kafka:3.9.2 /opt/kafka/bin/kafka-storage.sh random-uuid
```

If Kafka is installed locally, this works too:

```sh
kafka-storage.sh random-uuid
```

Store the resulting value in `chart/secrets.yaml` under `secrets.kafka.cluster_id`.

Warning: `CLUSTER_ID` is immutable after the first deploy. Changing it later requires wiping the Kafka PVC, which destroys all topic data.

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

## Known Limitations

- `SASL_PLAINTEXT`: credentials are authenticated but not TLS-encrypted; intended for intra-cluster traffic only
- Single Kafka broker: no replication or broker-level fault tolerance; all replication factors are `1`
- No TLS on Ingress: add a `cert-manager`-managed `tls` block for production HTTPS
- No external Kafka access: no `LoadBalancer` or `NodePort` is exposed
