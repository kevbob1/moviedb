

cassandra_config = YAML.load(ERB.new(File.read(Rails.root.join("config", "cassandra.yml"))).result)[Rails.env]

CASSANDRA_CONNECTION = CassandraCQL::Database.new(cassandra_config["host"], {:keyspace => cassandra_config["keyspace"], :cql_version => '3.0.0'})
