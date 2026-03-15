# frozen_string_literal: true

namespace :kafka do
  desc "Start the Kafka consumer for movie sync events"
  task consume: :environment do
    KafkaConsumerService.new.start
  end
end
