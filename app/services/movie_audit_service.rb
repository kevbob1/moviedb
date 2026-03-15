# frozen_string_literal: true

class MovieAuditService
  TOPIC = "moviedb.audit"

  def initialize(kafka_client: nil)
    @kafka_client = kafka_client || Kafka.new(
      Rails.application.config.kafka[:brokers],
      client_id: Rails.application.config.kafka[:client_id]
    )
  end

  def publish_audit(action:, record_id:, before: nil, after: nil)
    payload = {
      event: "movie.#{action}",
      record_id: record_id,
      timestamp: Time.current.iso8601,
      before: before,
      after: after
    }

    @kafka_client.deliver_message(payload.to_json, topic: TOPIC)
  rescue StandardError => e
    Rails.logger.error("Kafka audit publish failed for record #{record_id}: #{e.message}")
  end
end
