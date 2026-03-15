# frozen_string_literal: true

require "rails_helper"

RSpec.describe KafkaProducerService do
  self.use_transactional_tests = false

  let(:kafka_client) { instance_double("Kafka::Client") }
  let(:producer) { described_class.new(kafka_client: kafka_client) }
  let(:movie) do
    double("Movie", id: 1, tmdb_id: 550, title: "Fight Club")
  end

  describe "#publish_movie_sync" do
    before do
      allow(kafka_client).to receive(:deliver_message)
    end

    it "calls deliver_message on the kafka client with the correct topic" do
      producer.publish_movie_sync(movie, action: :created)

      expect(kafka_client).to have_received(:deliver_message).with(
        anything,
        topic: "moviedb.movies.sync"
      )
    end

    it "sends a JSON payload containing event, movie_id, tmdb_id, title, and timestamp" do
      producer.publish_movie_sync(movie, action: :created)

      expect(kafka_client).to have_received(:deliver_message) do |payload, **_opts|
        parsed = JSON.parse(payload)
        expect(parsed).to include(
          "event" => "movie.created",
          "movie_id" => 1,
          "tmdb_id" => 550,
          "title" => "Fight Club"
        )
        expect(parsed).to have_key("timestamp")
      end
    end

    context "when action is :created" do
      it "sets event to movie.created" do
        producer.publish_movie_sync(movie, action: :created)

        expect(kafka_client).to have_received(:deliver_message) do |payload, **_opts|
          parsed = JSON.parse(payload)
          expect(parsed["event"]).to eq("movie.created")
        end
      end
    end

    context "when action is :updated" do
      it "sets event to movie.updated" do
        producer.publish_movie_sync(movie, action: :updated)

        expect(kafka_client).to have_received(:deliver_message) do |payload, **_opts|
          parsed = JSON.parse(payload)
          expect(parsed["event"]).to eq("movie.updated")
        end
      end
    end

    context "when deliver_message raises Kafka::Error" do
      before do
        allow(kafka_client).to receive(:deliver_message).and_raise(Kafka::Error.new("connection failed"))
      end

      it "raises KafkaProducerService::Error" do
        expect {
          producer.publish_movie_sync(movie, action: :created)
        }.to raise_error(KafkaProducerService::Error, "connection failed")
      end
    end
  end
end
