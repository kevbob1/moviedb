class Movie < ApplicationRecord
  validates :title, presence: true
  validates :release_date, numericality: { only_integer: true }, allow_nil: true
  validates :tmdb_id, uniqueness: true, allow_nil: true
end
