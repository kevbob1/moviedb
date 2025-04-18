class RemoveRecords < ActiveRecord::Migration[7.2]
  def change
    drop_table :event_records
    drop_table :command_records
    drop_table :stream_records
  end
end
