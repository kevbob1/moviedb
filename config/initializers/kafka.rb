# frozen_string_literal: true

if Rails.env.test?
  Rails.application.config.kafka = {
    "bootstrap.servers" => ENV.fetch("KAFKA_BROKERS", "localhost:9092"),
    "client.id" => "moviedb"
  }
else
  unless ENV.key?("KAFKA_USERNAME") && ENV.key?("KAFKA_PASSWORD")
    raise RuntimeError, "KAFKA_USERNAME and KAFKA_PASSWORD must both be set for Kafka SASL authentication"
  end

  unless ENV.key?("KAFKA_BROKERS")
    Rails.logger.warn("KAFKA_BROKERS not set; defaulting to localhost:9092")
  end

  Rails.application.config.kafka = {
    "bootstrap.servers" => ENV.fetch("KAFKA_BROKERS", "localhost:9092"),
    "client.id" => "moviedb",
    "security.protocol" => "SASL_SSL",
    "sasl.mechanisms" => "SCRAM-SHA-512",
    "sasl.username" => ENV.fetch("KAFKA_USERNAME"),
    "sasl.password" => ENV.fetch("KAFKA_PASSWORD")
  }
end
