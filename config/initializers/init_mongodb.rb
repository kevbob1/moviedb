
  MongoRecord::Base.connection =
    Mongo::Connection.new.db(DB_NAME)