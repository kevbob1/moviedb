#!/usr/bin/env bash
set -e

# Write JAAS config so the broker can authenticate on the SASL_PLAINTEXT listener
cat > /tmp/kafka_jaas.conf <<EOF
KafkaServer {
  org.apache.kafka.common.security.scram.ScramLoginModule required
  username="${KAFKA_SCRAM_USERNAME}"
  password="${KAFKA_SCRAM_PASSWORD}";
};
EOF
export KAFKA_OPTS="-Djava.security.auth.login.config=/tmp/kafka_jaas.conf"

# Write server.properties directly from env vars.
# Bypasses KafkaDockerWrapper, which does not support --add-scram and always
# reformats storage (wiping SCRAM credentials added in a prior format step).
DATA_DIR="${KAFKA_LOG_DIRS:-/tmp/kraft-combined-logs}"
cat > /opt/kafka/config/server.properties <<EOF
process.roles=${KAFKA_PROCESS_ROLES}
node.id=${KAFKA_NODE_ID}
controller.quorum.voters=${KAFKA_CONTROLLER_QUORUM_VOTERS}
listeners=${KAFKA_LISTENERS}
advertised.listeners=${KAFKA_ADVERTISED_LISTENERS}
listener.security.protocol.map=${KAFKA_LISTENER_SECURITY_PROTOCOL_MAP}
controller.listener.names=${KAFKA_CONTROLLER_LISTENER_NAMES}
inter.broker.listener.name=${KAFKA_INTER_BROKER_LISTENER_NAME}
sasl.enabled.mechanisms=${KAFKA_SASL_ENABLED_MECHANISMS}
sasl.mechanism.inter.broker.protocol=${KAFKA_SASL_MECHANISM_INTER_BROKER_PROTOCOL}
listener.name.sasl_plaintext.scram-sha-512.sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username="${KAFKA_SCRAM_USERNAME}" password="${KAFKA_SCRAM_PASSWORD}";
offsets.topic.replication.factor=${KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR:-1}
transaction.state.log.replication.factor=${KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR:-1}
transaction.state.log.min.isr=${KAFKA_TRANSACTION_STATE_LOG_MIN_ISR:-1}
log.dirs=${DATA_DIR}
EOF

# Format storage with SCRAM credentials if not already formatted
if [ ! -f "${DATA_DIR}/meta.properties" ]; then
  /opt/kafka/bin/kafka-storage.sh format \
    --config /opt/kafka/config/server.properties \
    --cluster-id "${CLUSTER_ID}" \
    --add-scram "SCRAM-SHA-512=[name=${KAFKA_SCRAM_USERNAME},password=${KAFKA_SCRAM_PASSWORD}]"
fi

# Start the broker in the background so we can create topics after it's ready
/opt/kafka/bin/kafka-server-start.sh /opt/kafka/config/server.properties &
KAFKA_PID=$!

# Wait for the broker to become available
KAFKA_READY=0
for i in $(seq 1 30); do
  if /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092 \
      --command-config <(printf 'security.protocol=SASL_PLAINTEXT\nsasl.mechanism=SCRAM-SHA-512\nsasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username="%s" password="%s";\n' "${KAFKA_SCRAM_USERNAME}" "${KAFKA_SCRAM_PASSWORD}") \
      > /dev/null 2>&1; then
    KAFKA_READY=1
    break
  fi
  sleep 2
done

if [ "${KAFKA_READY}" -eq 0 ]; then
  echo "ERROR: Kafka broker did not become ready in time" >&2
  kill "${KAFKA_PID}"
  exit 1
fi

# Create required topics (idempotent — skips if already exists)
ADMIN_CONFIG=$(mktemp)
printf 'security.protocol=SASL_PLAINTEXT\nsasl.mechanism=SCRAM-SHA-512\nsasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username="%s" password="%s";\n' \
  "${KAFKA_SCRAM_USERNAME}" "${KAFKA_SCRAM_PASSWORD}" > "${ADMIN_CONFIG}"

for TOPIC in moviedb.movies.sync moviedb.audit; do
  if ! /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092 \
      --command-config "${ADMIN_CONFIG}" 2>/dev/null | grep -qx "${TOPIC}"; then
    /opt/kafka/bin/kafka-topics.sh --create \
      --topic "${TOPIC}" \
      --bootstrap-server localhost:9092 \
      --partitions 1 \
      --replication-factor 1 \
      --command-config "${ADMIN_CONFIG}"
    echo "Created topic: ${TOPIC}"
  else
    echo "Topic already exists: ${TOPIC}"
  fi
done

rm -f "${ADMIN_CONFIG}"

# Hand off to the broker process
wait "${KAFKA_PID}"
