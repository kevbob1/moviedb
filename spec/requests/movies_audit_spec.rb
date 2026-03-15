# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Movies audit integration", type: :request do
  let(:kafka_client) { instance_double("Kafka::Client", deliver_message: nil) }

  before do
    allow(Kafka).to receive(:new).and_return(kafka_client)
  end

  let(:valid_attributes) do
    { title: "The Matrix", description: "A computer hacker learns about the true nature of reality.", release_date: 1999 }
  end

  let(:invalid_attributes) do
    { title: "", description: "Missing title movie", release_date: 2000 }
  end

  describe "POST /movies" do
    it "publishes a create audit event" do
      post movies_path, params: { movie: valid_attributes }

      expect(kafka_client).to have_received(:deliver_message).with(
        anything,
        topic: "moviedb.audit"
      ).at_least(:once)

      audit_calls = []
      expect(kafka_client).to have_received(:deliver_message).at_least(:once) do |payload, **_opts|
        parsed = JSON.parse(payload)
        audit_calls << parsed if parsed.key?("record_id")
      end

      audit_event = audit_calls.find { |c| c["event"] == "movie.created" }
      expect(audit_event).not_to be_nil
      expect(audit_event["before"]).to be_nil
      expect(audit_event["after"]).to be_a(Hash)
      expect(audit_event["after"]["title"]).to eq("The Matrix")
    end
  end

  describe "PATCH /movies/:id" do
    it "publishes an update audit event with before and after" do
      movie = create(:movie, title: "Original Title")

      # Reset tracking from create
      allow(kafka_client).to receive(:deliver_message)

      patch movie_path(movie), params: { movie: { title: "Updated Title" } }

      audit_calls = []
      expect(kafka_client).to have_received(:deliver_message).at_least(:once) do |payload, **_opts|
        parsed = JSON.parse(payload)
        audit_calls << parsed if parsed.key?("record_id")
      end

      audit_event = audit_calls.find { |c| c["event"] == "movie.updated" }
      expect(audit_event).not_to be_nil
      expect(audit_event["before"]).to be_a(Hash)
      expect(audit_event["after"]).to be_a(Hash)
      expect(audit_event["after"]["title"]).to eq("Updated Title")
    end
  end

  describe "DELETE /movies/:id" do
    it "publishes a destroy audit event with after nil" do
      movie = create(:movie)

      # Reset tracking from create
      allow(kafka_client).to receive(:deliver_message)

      delete movie_path(movie)

      audit_calls = []
      expect(kafka_client).to have_received(:deliver_message).at_least(:once) do |payload, **_opts|
        parsed = JSON.parse(payload)
        audit_calls << parsed if parsed.key?("record_id")
      end

      audit_event = audit_calls.find { |c| c["event"] == "movie.destroyed" }
      expect(audit_event).not_to be_nil
      expect(audit_event["after"]).to be_nil
      expect(audit_event["before"]).to be_a(Hash)
    end
  end

  describe "POST /movies with invalid params" do
    it "does not publish audit" do
      post movies_path, params: { movie: invalid_attributes }

      expect(kafka_client).not_to have_received(:deliver_message).with(
        anything,
        topic: "moviedb.audit"
      )
    end
  end

  describe "CRUD succeeds when Kafka is down" do
    before do
      allow(kafka_client).to receive(:deliver_message).and_raise(Kafka::Error.new("connection refused"))
      allow(Rails.logger).to receive(:error)
    end

    it "POST /movies succeeds despite Kafka failure" do
      expect {
        post movies_path, params: { movie: valid_attributes }
      }.to change(Movie, :count).by(1)

      expect(response).to have_http_status(:found)
    end
  end
end
