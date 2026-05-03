class CreateMovies < ActiveRecord::Migration[7.2]
  def change
    create_table :movies do |t|
      t.string :title
      t.text :description
      t.integer :release_date

      t.timestamps
    end
  end
end
