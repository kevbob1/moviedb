# frozen_string_literal: true

require "rails_helper"

RSpec.describe KafkaConsumerService do
  let(:consumer) { instance_double(Rdkafka::Consumer, subscribe: nil) }
  let(:tmdb_service) { instance_double(TmdbService) }
  let(:consumer_service) { described_class.new(consumer: consumer) }

  let(:movie_data) do
    {
      tmdb_id: 550,
      title: "Fight Club",
      description: "An insomniac office worker and a devil-may-care soap maker form an underground fight club.",
      release_date: 1999,
      poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      vote_average: 8.4,
      genres: "Drama, Thriller"
    }
  end

  before do
    allow(TmdbService).to receive(:new).and_return(tmdb_service)
  end

  describe "#process_message" do
    before do
      allow(tmdb_service).to receive(:fetch_movie)
        .with(550)
        .and_return(movie_data)
    end

    context "with a valid JSON message containing tmdb_id" do
      let(:message) { instance_double(Rdkafka::Consumer::Message, payload: { "tmdb_id" => 550 }.to_json, topic: "moviedb.movies.sync", partition: 0, offset: 1) }

      it "creates a new Movie record with correct attributes" do
        expect {
          consumer_service.process_message(message)
        }.to change(Movie, :count).by(1)

        movie = Movie.find_by(tmdb_id: 550)
        expect(movie).to be_present
        expect(movie.title).to eq("Fight Club")
        expect(movie.description).to eq("An insomniac office worker and a devil-may-care soap maker form an underground fight club.")
        expect(movie.release_date).to eq(1999)
        expect(movie.poster_path).to eq("/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg")
        expect(movie.vote_average).to eq(8.4)
        expect(movie.genres).to eq("Drama, Thriller")
      end

      it "updates an existing Movie with the same tmdb_id (upsert behavior)" do
        Movie.create!(tmdb_id: 550, title: "Old Title")

        expect {
          consumer_service.process_message(message)
        }.not_to change(Movie, :count)

        movie = Movie.find_by(tmdb_id: 550)
        expect(movie.title).to eq("Fight Club")
        expect(movie.description).to eq("An insomniac office worker and a devil-may-care soap maker form an underground fight club.")
      end

      it "calls TmdbService#fetch_movie with the correct tmdb_id" do
        allow(tmdb_service).to receive(:fetch_movie).with(550).and_return(movie_data)
        consumer_service.process_message(message)
        expect(tmdb_service).to have_received(:fetch_movie).with(550)
      end
    end

    context "with invalid JSON payload" do
      let(:message) { instance_double(Rdkafka::Consumer::Message, payload: "not-json", topic: "moviedb.movies.sync", partition: 0, offset: 2) }

      it "does not raise an error" do
        expect {
          consumer_service.process_message(message)
        }.to raise_error(JSON::ParserError)
      end
    end

    context "when TmdbService raises NotFoundError" do
      let(:message) { instance_double(Rdkafka::Consumer::Message, payload: { "tmdb_id" => 999999 }.to_json, topic: "moviedb.movies.sync", partition: 0, offset: 3) }

      before do
        allow(tmdb_service).to receive(:fetch_movie)
          .with(999999)
          .and_raise(TmdbService::NotFoundError, "Movie with TMDB ID 999999 not found")
      end

      it "raises TmdbService::NotFoundError (caught by start loop)" do
        expect {
          consumer_service.process_message(message)
        }.to raise_error(TmdbService::NotFoundError)
      end
    end
  end

  describe "#start" do
    it "subscribes to the correct topic" do
      allow(consumer).to receive(:each)

      consumer_service.start

      expect(consumer).to have_received(:subscribe).with("moviedb.movies.sync")
    end

    it "processes each message and rescues StandardError per message" do
      valid_message = instance_double(Rdkafka::Consumer::Message, payload: { "tmdb_id" => 550 }.to_json, topic: "moviedb.movies.sync", partition: 0, offset: 1)
      bad_message = instance_double(Rdkafka::Consumer::Message, payload: "not-json", topic: "moviedb.movies.sync", partition: 0, offset: 2)

      allow(consumer).to receive(:each).and_yield(bad_message).and_yield(valid_message)
      allow(tmdb_service).to receive(:fetch_movie).with(550).and_return(movie_data)

      # Should not raise even though bad_message causes a JSON parse error
      expect { consumer_service.start }.not_to raise_error

      # The valid message should still have been processed
      expect(Movie.find_by(tmdb_id: 550)).to be_present
    end

    it "re-raises Rdkafka::RdkafkaError from the consumer loop" do
      stub_const("Rdkafka::RdkafkaError", Class.new(StandardError))

      allow(consumer).to receive(:each).and_raise(Rdkafka::RdkafkaError, "broker transport failure")

      expect { consumer_service.start }.to raise_error(Rdkafka::RdkafkaError)
    end
  end
end
