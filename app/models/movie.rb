class Movie
  include ActiveAttr::Model
  
  ALL_LIMIT = 50
  
	self.include_root_in_json = false
	
  attribute :title
  attribute :description
  attribute :watched
  attribute :id
  attribute :version
  attribute :created_at
  attribute :updated_at

  validates_presence_of :title
  
  def self.to_title_idx(title)
    if !title.nil?
      title[0..1].upcase
    else
      nil
    end
  end
  
  def title_idx
    self.class.to_title_idx(self.title)
  end
  

  def self.connection
    CASSANDRA_CONNECTION
  end
  
  protected
  
  def self.from_store(row)
    row = row.to_hash
    
    my_created_at = row.delete('created_at')
    my_updated_at = row.delete('updated_at')
    my_version = row.delete('version')
    
    movie = Movie.new(row) do |m|
      m.version = my_version
      m.id = row["id"].to_guid
      m.created_at = my_created_at
      m.updated_at = my_updated_at
    end
    movie.new_record = false
    return movie
  end
  
  public
  
  def self.find_by_title title_part
    title_idx = to_title_idx(title_part)
    title_part_up = title_part.upcase
    results = []
    
    # search index for match
    # should match 
    connection.execute("SELECT * FROM movies_title_idx where idx = ?", title_idx).fetch do |idx_row|
      # avoid returning ghost rows by checking one of the required column values
      next if idx_row["title"].nil?
      
      next unless (idx_row["title"].upcase.starts_with?(title_part_up))

      # N+1 problem here.  joins are not supported, so the only way to get
      # movie rows is to fetch them one by one.      
      results << self.find(idx_row["id"].to_guid)
    end
    return results
  end

  def self.find(id)
    row = connection.execute("SELECT * FROM movies WHERE id = ?", id).fetch
    return nil if row.nil?
    # avoid returning ghost rows by checking one of the required column values
    return nil if row["version"].nil?
    return Movie.from_store(row)
  end
    
  def self.all(limit = nil)
    results = []
    
    cql = "SELECT * FROM movies"
    if !limit.nil?
      cql += " LIMIT #{limit}"
    end
      
    connection.execute(cql).fetch do |row|
      next if row["version"].nil?      
      results << from_store(row)
    end
    
    return results
  end

  def self.count
    return all.size
  end
  
  def self.delete_all
    self.all.each do |m|
      m.destroy
    end
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
      self.id = UUID.generate
    end
    self.class.connection.execute("INSERT INTO movies (id, title, description, watched, version, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?)", self.id, self.title, self.description, self.watched, self.version, self.created_at, self.updated_at)
    self.remove_index
    self.class.connection.execute("INSERT INTO movies_title_idx (idx, title, id, id2) VALUES (?, ?, ?, ?)", self.title_idx, self.title, self.id, self.id)
    self.new_record = false
    true
  end
  
  def remove_index
    row = self.class.connection.execute("SELECT * FROM movies_title_idx WHERE id2 = ?", self.id).fetch
    return nil if row.nil?

    self.class.connection.execute("DELETE FROM movies_title_idx WHERE idx = ? AND title = ? AND id= ?", row["idx"], row["title"], self.id)
    
  end
  
  def destroy
    return if self.new_record?
    self.class.connection.execute("DELETE FROM movies WHERE id = ?", self.id)
    self.remove_index

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