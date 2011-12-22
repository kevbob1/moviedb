class CreateMovieColumnFamily < ActiveColumn::Migration

  def self.up
		create_column_family :movies do |cf|
			cf.comment = 'movies for something'
			cf.comparator_type = 'UTF8Type'
		end
  end

  def self.down
		drop_column_family :movies
  end

end