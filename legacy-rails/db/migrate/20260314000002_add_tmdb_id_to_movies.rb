class AddTmdbIdToMovies < ActiveRecord::Migration[7.2]
  def change
    add_column :movies, :tmdb_id, :integer
    add_index :movies, :tmdb_id, unique: true
  end
end
