# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# Note that this schema.rb definition is the authoritative source for your
# database schema. If you need to create the application database on another
# system, you should be using db:schema:load, not running all the migrations
# from scratch. The latter is a flawed and unsustainable approach (the more migrations
# you'll amass, the slower it'll run and the greater likelihood for issues).
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema.define(version: 20171120045054) do

  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "command_records", force: :cascade do |t|
    t.string "user_id"
    t.string "aggregate_id"
    t.string "command_type", null: false
    t.text "command_json", null: false
    t.datetime "created_at", null: false
  end

# Could not dump table "event_records" because of following NoMethodError
#   undefined method `to_sym' for nil:NilClass

  create_table "stream_records", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "aggregate_type", null: false
    t.string "aggregate_id", null: false
    t.integer "snapshot_threshold"
    t.index ["aggregate_id"], name: "index_stream_records_on_aggregate_id", unique: true
  end

  add_foreign_key "event_records", "command_records", name: "command_fkey"
  add_foreign_key "event_records", "stream_records", name: "stream_fkey"
end
