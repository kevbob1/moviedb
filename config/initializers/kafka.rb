# frozen_string_literal: true

Rails.application.config.kafka = {
  brokers: ENV.fetch("KAFKA_BROKERS", "localhost:9092").split(","),
  client_id: "moviedb"
}

unless ENV.key?("KAFKA_BROKERS") || Rails.env.test?
  Rails.logger.warn("KAFKA_BROKERS not set; defaulting to localhost:9092")
end
