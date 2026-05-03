# frozen_string_literal: true

class MovieAuditService
  TOPIC = "moviedb.audit"

  def initialize(producer: nil)
    @producer = producer || Rdkafka::Config.new(Rails.application.config.kafka).producer
  end

  def publish_audit(action:, record_id:, before: nil, after: nil)
    payload = {
      event: "movie.#{action}",
      record_id: record_id,
      timestamp: Time.current.iso8601,
      before: before,
      after: after
    }

    handle = @producer.produce(topic: TOPIC, payload: payload.to_json)
    handle.wait(max_wait_timeout: 5)
  rescue StandardError => e
    Rails.logger.error("Kafka audit publish failed for record #{record_id}: #{e.message}")
  end
end
