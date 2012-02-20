class Movie
  include ActiveModel::Validations
  include ActiveModel::Conversion
  include ActiveModel::Serializers
  extend ActiveModel::Naming
  include ActiveModel::Dirty
  
  define_attribute_methods [:title, :description, :watched, :version]
  
  attr_accessor :title, :description, :watched, :version
  attr_reader :created_at, :updated_at
  validates_presence_of :title, :version 

  def self.set_connection_info(host, keyspace)
    @@host = host
    @@keyspace = keyspace
  end
  
  def self.new_connection
    CassandraCQL::Database.new(@@host, {:keyspace => @@keyspace})
  end
  
  def self.connection
    @@connection ||= new_connection
  end
  
  def self.find title
    result = []
    
    connection.execute("SELECT * FROM movies WHERE title=?", title).fetch do |row|
      # avoid returning ghost rows by checking one of the required column values
      next if row["version"].nil?
      movie = Movie.new(row)
      movie.new_record = false
      result << movie
    end
    result[0]
  end

  def self.all
    results = []
    
    connection.execute("SELECT * FROM movies").fetch do |row|
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
    #args = args.stringify_keys if args.is_a?(Hash)
    @title = args["title"]
    @description = args["description"]
    @watched = args["watched"]
    @version = args["version"]
    @created_at = args["created_at"]
    @updated_at = args["updated_at"]
    @new_record = true
  end

  def attributes
    {
      :title => @title,
      :description => @description,
      :watched => @watched,
      :version => @version,
      :created_at => @created_at,
      :updated_at => @updated_at
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
  
  def to_param
    if persisted?
      @title
    else
      nil
    end
  end
  
  def to_key
    @title
  end
  
  def save
    if !new_record?
      @updated_at = Time.now
      @version += 1
    else
      @updated_at = Time.now
      @created_at = Time.now
      @verson = 1
    end
    
    self.class.connection.execute("INSERT INTO movies (title, description, watched, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)", @title, @description, @watched, @version, @created_at, @updated_at)
    @new_record = false
    true
  end
  
  def destroy
    return if @new_record
    self.class.connection.execute("DELETE FROM movies WHERE title=?", @title)
  end
end