#!/usr/bin/env bash
#
# provision/kafka.sh
# Installs Apache Kafka 3.7.0 in KRaft mode (no ZooKeeper) on the Vagrant VM.
# Designed to be idempotent — safe to run multiple times.
#
set -euo pipefail

KAFKA_VERSION="3.7.0"
SCALA_VERSION="2.13"
KAFKA_DIR="/opt/kafka"
KAFKA_DATA_DIR="/var/lib/kafka/data"
KAFKA_LOG_DIR="/var/log/kafka"
KAFKA_TGZ="kafka_${SCALA_VERSION}-${KAFKA_VERSION}.tgz"
KAFKA_DOWNLOAD_URL="https://downloads.apache.org/kafka/${KAFKA_VERSION}/${KAFKA_TGZ}"
CLUSTER_ID_FILE="/var/lib/kafka/cluster-id"

echo "==> [Kafka] Installing OpenJDK 17..."
apt-get update -qq
apt-get install -y -qq openjdk-17-jre-headless > /dev/null 2>&1
java -version 2>&1 || true

echo "==> [Kafka] Creating kafka system user..."
if ! id -u kafka > /dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin kafka
fi

echo "==> [Kafka] Downloading Kafka ${KAFKA_VERSION}..."
if [ ! -d "${KAFKA_DIR}" ]; then
  cd /tmp
  if [ ! -f "${KAFKA_TGZ}" ]; then
    curl -fsSL -o "${KAFKA_TGZ}" "${KAFKA_DOWNLOAD_URL}"
  fi
  mkdir -p "${KAFKA_DIR}"
  tar -xzf "${KAFKA_TGZ}" --strip-components=1 -C "${KAFKA_DIR}"
  rm -f "${KAFKA_TGZ}"
fi

echo "==> [Kafka] Creating data and log directories..."
mkdir -p "${KAFKA_DATA_DIR}"
mkdir -p "${KAFKA_LOG_DIR}"
chown -R kafka:kafka "${KAFKA_DATA_DIR}"
chown -R kafka:kafka "${KAFKA_LOG_DIR}"
chown -R kafka:kafka "${KAFKA_DIR}"

echo "==> [Kafka] Writing KRaft server.properties..."
mkdir -p "${KAFKA_DIR}/config/kraft"
cat > "${KAFKA_DIR}/config/kraft/server.properties" <<'PROPS'
# KRaft single-node configuration for moviedb development
node.id=1
process.roles=broker,controller
controller.quorum.voters=1@localhost:9093

listeners=PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
advertised.listeners=PLAINTEXT://localhost:9092
listener.security.protocol.map=PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT
controller.listener.names=CONTROLLER
inter.broker.listener.name=PLAINTEXT

log.dirs=/var/lib/kafka/data
num.partitions=1
offsets.topic.replication.factor=1
transaction.state.log.replication.factor=1
transaction.state.log.min.isr=1

log.retention.hours=168
log.segment.bytes=1073741824
log.retention.check.interval.ms=300000
PROPS

echo "==> [Kafka] Formatting KRaft storage (idempotent)..."
if [ ! -f "${CLUSTER_ID_FILE}" ]; then
  CLUSTER_ID=$("${KAFKA_DIR}/bin/kafka-storage.sh" random-uuid)
  mkdir -p "$(dirname "${CLUSTER_ID_FILE}")"
  echo "${CLUSTER_ID}" > "${CLUSTER_ID_FILE}"
  "${KAFKA_DIR}/bin/kafka-storage.sh" format \
    -t "${CLUSTER_ID}" \
    -c "${KAFKA_DIR}/config/kraft/server.properties"
  chown -R kafka:kafka "${KAFKA_DATA_DIR}"
fi

echo "==> [Kafka] Installing systemd service unit..."
cat > /etc/systemd/system/kafka.service <<'UNIT'
[Unit]
Description=Apache Kafka (KRaft)
After=network.target

[Service]
Type=simple
User=kafka
ExecStart=/opt/kafka/bin/kafka-server-start.sh /opt/kafka/config/kraft/server.properties
ExecStop=/opt/kafka/bin/kafka-server-stop.sh
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT

echo "==> [Kafka] Enabling and starting Kafka service..."
systemctl daemon-reload
systemctl enable kafka
systemctl start kafka

echo "==> [Kafka] Waiting for Kafka to become ready..."
RETRIES=30
for i in $(seq 1 $RETRIES); do
  if "${KAFKA_DIR}/bin/kafka-broker-api-versions.sh" --bootstrap-server localhost:9092 > /dev/null 2>&1; then
    echo "==> [Kafka] Broker is ready."
    break
  fi
  if [ "$i" -eq "$RETRIES" ]; then
    echo "==> [Kafka] WARNING: Broker did not become ready after ${RETRIES} attempts. Continuing anyway."
  fi
  sleep 2
done

echo "==> [Kafka] Creating topics (idempotent)..."
"${KAFKA_DIR}/bin/kafka-topics.sh" \
  --bootstrap-server localhost:9092 \
  --create --topic moviedb.movies.sync \
  --partitions 1 --replication-factor 1 \
  --if-not-exists || true

"${KAFKA_DIR}/bin/kafka-topics.sh" \
  --bootstrap-server localhost:9092 \
  --create --topic moviedb.movie_events \
  --partitions 1 --replication-factor 1 \
  --if-not-exists || true

echo "==> [Kafka] Listing topics..."
"${KAFKA_DIR}/bin/kafka-topics.sh" --bootstrap-server localhost:9092 --list || true

echo "==> [Kafka] Provisioning complete."
