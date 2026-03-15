#!/usr/bin/env bash
set -e

PROPERTIES_FILE="/tmp/server.properties"

# Write JAAS config so the broker can authenticate on the SASL_PLAINTEXT listener
cat > /tmp/kafka_jaas.conf <<EOF
KafkaServer {
  org.apache.kafka.common.security.scram.ScramLoginModule required
  username="${KAFKA_SCRAM_USERNAME}"
  password="${KAFKA_SCRAM_PASSWORD}";
};
EOF
export KAFKA_OPTS="-Djava.security.auth.login.config=/tmp/kafka_jaas.conf"

# Generate server.properties from environment variables
/etc/kafka/docker/configure

# Determine data directory from generated properties
DATA_DIR=$(grep '^log.dirs=' "$PROPERTIES_FILE" | cut -d= -f2)

# If broker has not been formatted yet, format storage with SCRAM credentials
if [ ! -f "$DATA_DIR/meta.properties" ]; then
  /opt/kafka/bin/kafka-storage.sh format \
    --config "$PROPERTIES_FILE" \
    --cluster-id "${CLUSTER_ID}" \
    --add-scram "SCRAM-SHA-512=[name=${KAFKA_SCRAM_USERNAME},password=${KAFKA_SCRAM_PASSWORD}]" \
    --ignore-formatted
fi

# Start the broker
exec /opt/kafka/bin/kafka-server-start.sh "$PROPERTIES_FILE"
