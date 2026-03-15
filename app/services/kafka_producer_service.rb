# frozen_string_literal: true

class KafkaProducerService
  TOPIC = "moviedb.movies.sync"

  class Error < StandardError; end

  def initialize(kafka_client: nil)
    @kafka_client = kafka_client || Kafka.new(
      Rails.application.config.kafka[:brokers],
      client_id: Rails.application.config.kafka[:client_id]
    )
  end

  def publish_movie_sync(movie, action:)
    payload = {
      event: "movie.#{action}",
      movie_id: movie.id,
      tmdb_id: movie.tmdb_id,
      title: movie.title,
      timestamp: Time.current.iso8601
    }.to_json

    @kafka_client.deliver_message(payload, topic: TOPIC)
  rescue Kafka::Error => e
    raise Error, e.message
  end
end
