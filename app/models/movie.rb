
class Movie < MongoRecord::Base
  collection_name :movies
  fields :title
end

