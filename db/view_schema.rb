require_relative '../config/sequent_app'

Sequent::Support::ViewSchema.define(view_projection: SequentApp::VIEW_PROJECTION) do
  create_table :movie_records, :force => true do |t|
    t.string :aggregate_id, :null => false
    t.string :name
    t.string :description
  end

  add_index :movie_records, ["aggregate_id"], :name => "unique_aggregate_id_for_movie", :unique => true
end
