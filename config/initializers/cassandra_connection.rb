
cassandra_config = YAML.load_file(Rails.root.join("config", "cassandra.yml"))[Rails.env]

CASSANDRA_CONNECTION = CassandraCQL::Database.new(cassandra_config["host"], {:keyspace => cassandra_config["keyspace"], :cql_version => '3.0.0'})
