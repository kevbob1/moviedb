
config = YAML.load_file(Rails.root.join("config", "cassandra.yml"))[Rails.env]
Movie.set_connection_info(config["host"], config["keyspace"])
