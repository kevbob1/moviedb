class Movie
  include ActiveAttr::Model
  
	self.include_root_in_json = false
	
  attribute :title
  attribute :description
  attribute :watched
  attribute :id
  attribute :version
  attribute :created_at
  attribute :updated_at

  attr_protected :id
  attr_protected :version
  attr_protected :created_at
  attr_protected :updated_at
  
  validates_presence_of :title

  def self.connection
    CASSANDRA_CONNECTION
  end
  
  protected
  
  def self.from_store(row)
    row = row.to_hash
    movie = Movie.new(row) do |m|
      m.version = row["version"]
      m.id = row["KEY"]
      m.created_at = row["created_at"]
      m.updated_at = row["updated_at"]
    end
    movie.new_record = false
    return movie
  end
  
  public
  
  def self.find_by_title title
    results = []
    
    connection.execute("SELECT * FROM movies WHERE title LIKE ?", "#{title}%").fetch do |row|
      # avoid returning ghost rows by checking one of the required column values
      next if row["version"].nil?
      movie = Movie.from_store(row)
      results << movie
    end
    return results
  end

  def self.find id
    
    row = connection.execute("SELECT * FROM movies WHERE KEY = ?", id).fetch
    return nil if row.nil?

    # avoid returning ghost rows by checking one of the required column values
    return nil if row["version"].nil?
    return Movie.from_store(row)
  end
    
  def self.all
    results = []
    
    connection.execute("SELECT * FROM movies").fetch do |row|
      next if row["version"].nil?      
      results << Movie.from_store(row)
    end
    
    return results
  end

  def self.count
    return all.size
  end
  
  # instance methods
  
  def initialize(*)
    super
    self.new_record=true
  end
  
  def new_record?
    @new_record
  end
  
  def new_record=(val)
    @new_record = val
  end
  
  def persisted?
    !new_record?
  end
  
  def save
    if !self.new_record?
      self.updated_at = Time.now
      self.version = self.version + 1
    else
      self.updated_at = Time.now
      self.created_at = Time.now
      self.version = 1
      self.id = UUID.generate(:compact)
    end
    
    self.class.connection.execute("INSERT INTO movies (KEY, title, description, watched, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)", self.id, self.title, self.description, self.watched, self.version, self.created_at, self.updated_at)
    self.new_record = false
    true
  end
  
  def destroy
    return if self.new_record?
    self.class.connection.execute("DELETE FROM movies WHERE KEY = ?", self.id)
    self.id = nil
    self.new_record = true
    self.version = nil
    true
  end
  
  def update_attributes(attrs = {})
    assign_attributes attrs
    save
  end
  
end