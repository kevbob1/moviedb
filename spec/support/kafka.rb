# frozen_string_literal: true

RSpec.configure do |config|
  config.before(:each) do
    delivery_handle = double("Rdkafka::Producer::DeliveryHandle", wait: nil)
    producer = double("Rdkafka::Producer", produce: delivery_handle)
    consumer = double("Rdkafka::Consumer", subscribe: nil)
    allow(consumer).to receive(:each)

    rdkafka_config = double("Rdkafka::Config", producer: producer, consumer: consumer)
    allow(Rdkafka::Config).to receive(:new).and_return(rdkafka_config)
  end
end
