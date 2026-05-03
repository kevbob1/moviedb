# frozen_string_literal: true

RSpec.configure do |config|
  config.before do
    delivery_handle = instance_double(Rdkafka::Producer::DeliveryHandle, wait: nil)
    producer = instance_double(Rdkafka::Producer, produce: delivery_handle)
    consumer = instance_double(Rdkafka::Consumer, subscribe: nil)
    allow(consumer).to receive(:each)

    rdkafka_config = instance_double(Rdkafka::Config, producer: producer, consumer: consumer)
    allow(Rdkafka::Config).to receive(:new).and_return(rdkafka_config)
  end
end
