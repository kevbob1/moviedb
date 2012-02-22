class Movie
  include ActiveModel::Validations
  include ActiveModel::Conversion
  include ActiveModel::Serializers::JSON
  include ActiveModel::Serializers::Xml
  extend ActiveModel::Naming
  include ActiveModel::Dirty
  
  define_attribute_methods [:title, :description, :watched, :version]
  
  attr_accessor :title, :description, :watched, :version, :id
  attr_reader :created_at, :updated_at
  validates_presence_of :title 

  def self.connection
    CASSANDRA_CONNECTION
  end
  
  def self.find_by_title title
    results = []
    
    connection.execute("SELECT * FROM movies WHERE title LIKE ?", "#{title}%").fetch do |row|
      # avoid returning ghost rows by checking one of the required column values
      next if row["version"].nil?
      movie = Movie.new(row)
      movie.new_record = false
      results << movie
    end
    results
  end

  def self.find id
    
    row = connection.execute("SELECT * FROM movies WHERE KEY = ?", id).fetch
    return nil if row.nil?

    # avoid returning ghost rows by checking one of the required column values
    return nil if row["version"].nil?
    movie = Movie.new(row)
    movie.new_record = false
    return movie
  end
  
  
  def self.all
    results = []
    
    connection.execute("SELECT * FROM movies").fetch do |row|
      next if row["version"].nil?      
      movie = Movie.new(row)
      movie.new_record = false
      results << movie
    end
    
    results
  end

  def self.count
    return all.size
  end
  
  # instance methods
  
  def initialize(args = {})
    @id = args["KEY"]
    @title = args["title"]
    @description = args["description"]
    @watched = args["watched"]
    @version = args["version"]
    @created_at = args["created_at"]
    @updated_at = args["updated_at"]
    @new_record = true
  end
  
  def update_attributes(args)
    @title = args["title"]
    @description = args["description"]
    @watched = args["watched"]
    self.save
  end

  def attributes
    {
      "id" => @id,
      "title" => @title,
      "description" => @description,
      "watched" => @watched,
      "version" => @version,
      "created_at" => @created_at,
      "updated_at" => @updated_at
    }
  end
  
  def new_record?
    @new_record
  end
  
  def new_record=(val)
    @new_record = val
  end
  
  def persisted?
    !@new_record
  end
  
  def save
    if !self.new_record?
      @updated_at = Time.now
      @version += 1
    else
      @updated_at = Time.now
      @created_at = Time.now
      @version = 1
      @id = UUID.generate(:compact)
    end
    
    self.class.connection.execute("INSERT INTO movies (KEY, title, description, watched, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)", @id, @title, @description, @watched, @version, @created_at, @updated_at)
    @new_record = false
    true
  end
  
  def destroy
    return if @new_record
    self.class.connection.execute("DELETE FROM movies WHERE KEY = ?", @id)
    @id = nil
    @new_record = true
    @version = nil
  end
end