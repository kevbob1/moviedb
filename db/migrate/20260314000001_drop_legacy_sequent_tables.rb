# frozen_string_literal: true

class DropLegacySequentTables < ActiveRecord::Migration[7.2]
  def up
    # Remove foreign keys from event_records first
    remove_foreign_key :event_records, :command_records, name: :command_fkey
    remove_foreign_key :event_records, :stream_records, name: :stream_fkey

    # Drop tables in dependency-safe order
    drop_table :event_records
    drop_table :command_records
    drop_table :stream_records
  end

  def down
    # Recreate stream_records
    create_table :stream_records do |t|
      t.datetime :created_at, precision: nil, null: false
      t.string :aggregate_type, null: false
      t.string :aggregate_id, null: false
      t.integer :snapshot_threshold

      t.index [:aggregate_id], name: "index_stream_records_on_aggregate_id", unique: true
    end

    # Recreate command_records
    create_table :command_records do |t|
      t.string :user_id
      t.string :aggregate_id
      t.string :command_type, null: false
      t.text :command_json, null: false
      t.datetime :created_at, precision: nil, null: false
    end

    # Recreate event_records
    create_table :event_records do |t|
      t.string :aggregate_id, null: false
      t.integer :sequence_number, null: false
      t.datetime :created_at, precision: nil, null: false
      t.string :event_type, null: false
      t.text :event_json, null: false
      t.integer :command_record_id, null: false
      t.integer :stream_record_id, null: false

      t.index [:command_record_id], name: "index_event_records_on_command_record_id"
      t.index [:created_at], name: "index_event_records_on_created_at"
      t.index [:event_type], name: "index_event_records_on_event_type"
      t.index [:aggregate_id, :sequence_number], name: "snapshot_events", order: { sequence_number: :desc }, where: "((event_type)::text = 'Sequent::Core::SnapshotEvent'::text)"
    end

    # The unique_event_per_aggregate index uses a raw SQL expression, so we
    # must add it outside the create_table block.
    execute <<-SQL.squish
      CREATE UNIQUE INDEX unique_event_per_aggregate
        ON event_records (
          aggregate_id,
          sequence_number,
          (CASE event_type
             WHEN 'Sequent::Core::SnapshotEvent' THEN 0
             ELSE 1
           END)
        );
    SQL

    # Restore foreign keys
    add_foreign_key :event_records, :command_records, name: :command_fkey
    add_foreign_key :event_records, :stream_records, name: :stream_fkey
  end
end
