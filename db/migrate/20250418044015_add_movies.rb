class AddMovies < ActiveRecord::Migration[7.2]
  def change
    create_table :movies do |t|
      t.string :title
      t.date :release_date
      t.text :description
      t.timestamptz :created_at
      t.timestamptz :updated_at
    end
  end
end
