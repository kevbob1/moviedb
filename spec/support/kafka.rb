# frozen_string_literal: true

RSpec.configure do |config|
  config.before(:each) do
    kafka_consumer = instance_double("Kafka::Consumer", subscribe: nil)
    allow(kafka_consumer).to receive(:each_message)

    kafka_client = instance_double(
      "Kafka::Client",
      deliver_message: nil,
      consumer: kafka_consumer
    )

    allow(Kafka).to receive(:new).and_return(kafka_client)
  end
end
