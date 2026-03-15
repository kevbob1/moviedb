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

# Format storage with SCRAM credentials if not already formatted.
# Must happen before KafkaDockerWrapper runs, because --add-scram only applies
# during initial format and KafkaDockerWrapper does not support the flag.
DATA_DIR="${KAFKA_LOG_DIRS:-/tmp/kraft-combined-logs}"
if [ ! -f "$DATA_DIR/meta.properties" ]; then
  cat > /tmp/format.properties <<PROPS
process.roles=${KAFKA_PROCESS_ROLES}
node.id=${KAFKA_NODE_ID}
controller.quorum.voters=${KAFKA_CONTROLLER_QUORUM_VOTERS}
listeners=${KAFKA_LISTENERS}
advertised.listeners=${KAFKA_ADVERTISED_LISTENERS}
listener.security.protocol.map=${KAFKA_LISTENER_SECURITY_PROTOCOL_MAP}
controller.listener.names=${KAFKA_CONTROLLER_LISTENER_NAMES}
inter.broker.listener.name=${KAFKA_INTER_BROKER_LISTENER_NAME}
log.dirs=${DATA_DIR}
PROPS

  /opt/kafka/bin/kafka-storage.sh format \
    --config /tmp/format.properties \
    --cluster-id "${CLUSTER_ID}" \
    --add-scram "SCRAM-SHA-512=[name=${KAFKA_SCRAM_USERNAME},password=${KAFKA_SCRAM_PASSWORD}]"
fi

# Generate final server.properties from KAFKA_* env vars via the Docker wrapper.
# Storage is already formatted above; the wrapper may report "already formatted" — that is expected.
setup_result=$(/opt/kafka/bin/kafka-run-class.sh kafka.docker.KafkaDockerWrapper setup \
  --default-configs-dir /etc/kafka/docker \
  --mounted-configs-dir /mnt/shared/config \
  --final-configs-dir /opt/kafka/config 2>&1) || \
  echo "$setup_result" | grep -qi "already formatted" || \
  { echo "$setup_result"; exit 1; }

# Start the broker
exec /opt/kafka/bin/kafka-server-start.sh /opt/kafka/config/server.properties
