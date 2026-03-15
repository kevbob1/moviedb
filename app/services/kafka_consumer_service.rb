# frozen_string_literal: true

class KafkaConsumerService
  TOPIC = "moviedb.movies.sync"
  GROUP_ID = "moviedb-consumer"

  def initialize(consumer: nil)
    config = Rails.application.config.kafka
    @consumer = consumer || Rdkafka::Config.new(config.merge("group.id" => GROUP_ID)).consumer
  end

  def start
    @consumer.subscribe(TOPIC)

    Rails.logger.info("[KafkaConsumer] Subscribed to #{TOPIC} with group #{GROUP_ID}")

    @consumer.each do |message|
      Rails.logger.info("[KafkaConsumer] Received message on #{message.topic}, partition #{message.partition}, offset #{message.offset}")
      begin
        process_message(message)
      rescue StandardError => e
        Rails.logger.error("[KafkaConsumer] Error processing message: #{e.class} - #{e.message}")
      end
    end
  rescue Rdkafka::RdkafkaError => e
    Rails.logger.error("[KafkaConsumer] Kafka error: #{e.class} - #{e.message}")
    raise
  end

  def process_message(message)
    payload = JSON.parse(message.payload)
    tmdb_id = payload.fetch("tmdb_id")

    Rails.logger.info("[KafkaConsumer] Processing sync for tmdb_id=#{tmdb_id}")

    movie_data = TmdbService.new.fetch_movie(tmdb_id)

    movie = Movie.find_or_initialize_by(tmdb_id: tmdb_id)
    movie.assign_attributes(
      title: movie_data[:title],
      description: movie_data[:description],
      release_date: movie_data[:release_date],
      poster_path: movie_data[:poster_path],
      vote_average: movie_data[:vote_average],
      genres: movie_data[:genres]
    )
    movie.save!

    Rails.logger.info("[KafkaConsumer] Upserted movie '#{movie.title}' (tmdb_id=#{tmdb_id})")
  end
end
