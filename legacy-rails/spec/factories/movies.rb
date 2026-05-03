# frozen_string_literal: true

FactoryBot.define do
  factory :movie do
    title { Faker::Movie.title }
    description { Faker::Lorem.paragraph(sentence_count: 3) }
    release_date { rand(1970..2025) }
  end
end
