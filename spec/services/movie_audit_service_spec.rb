# frozen_string_literal: true

require "rails_helper"

RSpec.describe MovieAuditService do
  let(:delivery_handle) { double("Rdkafka::Producer::DeliveryHandle", wait: nil) }
  let(:producer) { double("Rdkafka::Producer") }
  let(:service) { described_class.new(producer: producer) }

  describe "#publish_audit" do
    before do
      allow(producer).to receive(:produce).and_return(delivery_handle)
    end

    it "publishes to moviedb.audit topic" do
      service.publish_audit(action: :created, record_id: 1, before: nil, after: { "title" => "Test" })

      expect(producer).to have_received(:produce).with(
        hash_including(topic: "moviedb.audit")
      )
    end

    it "calls wait on the delivery handle" do
      service.publish_audit(action: :created, record_id: 1, before: nil, after: { "title" => "Test" })

      expect(delivery_handle).to have_received(:wait).with(max_wait_timeout: 5)
    end

    it "sends JSON payload with event, record_id, timestamp, before, and after" do
      service.publish_audit(action: :created, record_id: 42, before: nil, after: { "title" => "Test" })

      expect(producer).to have_received(:produce) do |args|
        parsed = JSON.parse(args[:payload])
        expect(parsed).to have_key("event")
        expect(parsed).to have_key("record_id")
        expect(parsed).to have_key("timestamp")
        expect(parsed).to have_key("before")
        expect(parsed).to have_key("after")
        expect(parsed["record_id"]).to eq(42)
      end
    end

    it "sets event to movie.created for create action" do
      service.publish_audit(action: :created, record_id: 1, before: nil, after: { "title" => "Test" })

      expect(producer).to have_received(:produce) do |args|
        parsed = JSON.parse(args[:payload])
        expect(parsed["event"]).to eq("movie.created")
      end
    end

    it "sets before to nil for create action" do
      service.publish_audit(action: :created, record_id: 1, before: nil, after: { "title" => "Test" })

      expect(producer).to have_received(:produce) do |args|
        parsed = JSON.parse(args[:payload])
        expect(parsed["before"]).to be_nil
      end
    end

    it "sets after to nil for destroy action" do
      service.publish_audit(action: :destroyed, record_id: 1, before: { "title" => "Test" }, after: nil)

      expect(producer).to have_received(:produce) do |args|
        parsed = JSON.parse(args[:payload])
        expect(parsed["after"]).to be_nil
      end
    end

    it "includes both before and after for update action" do
      before_attrs = { "title" => "Old Title" }
      after_attrs = { "title" => "New Title" }

      service.publish_audit(action: :updated, record_id: 1, before: before_attrs, after: after_attrs)

      expect(producer).to have_received(:produce) do |args|
        parsed = JSON.parse(args[:payload])
        expect(parsed["before"]).to eq(before_attrs)
        expect(parsed["after"]).to eq(after_attrs)
      end
    end

    it "does not raise when Rdkafka::RdkafkaError occurs" do
      stub_const("Rdkafka::RdkafkaError", Class.new(StandardError))
      allow(producer).to receive(:produce).and_raise(Rdkafka::RdkafkaError.new("connection refused"))

      expect {
        service.publish_audit(action: :created, record_id: 1, before: nil, after: { "title" => "Test" })
      }.not_to raise_error
    end

    it "does not raise when StandardError occurs" do
      allow(producer).to receive(:produce).and_raise(StandardError.new("unexpected"))

      expect {
        service.publish_audit(action: :created, record_id: 1, before: nil, after: { "title" => "Test" })
      }.not_to raise_error
    end

    it "logs error when Kafka is unavailable" do
      stub_const("Rdkafka::RdkafkaError", Class.new(StandardError))
      allow(producer).to receive(:produce).and_raise(Rdkafka::RdkafkaError.new("connection refused"))
      allow(Rails.logger).to receive(:error)

      service.publish_audit(action: :created, record_id: 1, before: nil, after: { "title" => "Test" })

      expect(Rails.logger).to have_received(:error).with(/Kafka audit publish failed/)
    end
  end
end
