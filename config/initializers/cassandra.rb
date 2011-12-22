config = YAML.load_file(Rails.root.join("config", "cassandra.yml"))[Rails.env]
$cassandra = Cassandra.new(config['keyspace'],
                           config['servers'],
                           config['thrift'])

ActiveColumn.connection = $cassandra
