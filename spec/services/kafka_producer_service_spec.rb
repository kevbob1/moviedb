# frozen_string_literal: true

require "rails_helper"

RSpec.describe KafkaProducerService do
  self.use_transactional_tests = false

  let(:delivery_handle) { double("Rdkafka::Producer::DeliveryHandle", wait: nil) }
  let(:producer) { double("Rdkafka::Producer") }
  let(:service) { described_class.new(producer: producer) }
  let(:movie) do
    double("Movie", id: 1, tmdb_id: 550, title: "Fight Club")
  end

  describe "#publish_movie_sync" do
    before do
      allow(producer).to receive(:produce).and_return(delivery_handle)
    end

    it "calls produce on the producer with the correct topic" do
      service.publish_movie_sync(movie, action: :created)

      expect(producer).to have_received(:produce).with(
        hash_including(topic: "moviedb.movies.sync")
      )
    end

    it "calls wait on the delivery handle" do
      service.publish_movie_sync(movie, action: :created)

      expect(delivery_handle).to have_received(:wait).with(max_wait_timeout: 5)
    end

    it "sends a JSON payload containing event, movie_id, tmdb_id, title, and timestamp" do
      service.publish_movie_sync(movie, action: :created)

      expect(producer).to have_received(:produce) do |args|
        parsed = JSON.parse(args[:payload])
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
        service.publish_movie_sync(movie, action: :created)

        expect(producer).to have_received(:produce) do |args|
          parsed = JSON.parse(args[:payload])
          expect(parsed["event"]).to eq("movie.created")
        end
      end
    end

    context "when action is :updated" do
      it "sets event to movie.updated" do
        service.publish_movie_sync(movie, action: :updated)

        expect(producer).to have_received(:produce) do |args|
          parsed = JSON.parse(args[:payload])
          expect(parsed["event"]).to eq("movie.updated")
        end
      end
    end

    context "when produce raises Rdkafka::RdkafkaError" do
      before do
        stub_const("Rdkafka::RdkafkaError", Class.new(StandardError))
        allow(producer).to receive(:produce).and_raise(Rdkafka::RdkafkaError.new("connection failed"))
      end

      it "raises KafkaProducerService::Error" do
        expect {
          service.publish_movie_sync(movie, action: :created)
        }.to raise_error(KafkaProducerService::Error, "connection failed")
      end
    end
  end
end
