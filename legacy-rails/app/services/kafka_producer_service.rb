# frozen_string_literal: true

class KafkaProducerService
  TOPIC = "moviedb.movies.sync"

  class Error < StandardError; end

  def initialize(producer: nil)
    @producer = producer || Rdkafka::Config.new(Rails.application.config.kafka).producer
  end

  def publish_movie_sync(movie, action:)
    payload = {
      event: "movie.#{action}",
      movie_id: movie.id,
      tmdb_id: movie.tmdb_id,
      title: movie.title,
      timestamp: Time.current.iso8601
    }.to_json

    handle = @producer.produce(topic: TOPIC, payload: payload)
    handle.wait(max_wait_timeout: 5)
  rescue Rdkafka::RdkafkaError => e
    raise Error, e.message
  end
end
