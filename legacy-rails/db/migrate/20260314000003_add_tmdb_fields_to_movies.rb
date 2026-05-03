# frozen_string_literal: true

class AddTmdbFieldsToMovies < ActiveRecord::Migration[7.2]
  def change
    add_column :movies, :poster_path, :string
    add_column :movies, :vote_average, :decimal, precision: 3, scale: 1
    add_column :movies, :genres, :string
  end
end
