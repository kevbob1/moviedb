class CreateMovies < ActiveRecord::Migration
  def change
    create_table :movies do |t|
      t.string :title
      t.boolean :watched
      t.integer :version

      t.timestamps
    end
  end
end
