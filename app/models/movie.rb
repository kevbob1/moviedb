class Movie
  include ActiveModel::Validations
  include ActiveModel::Conversion
  extend ActiveModel::Naming
  include ActiveModel::Dirty
  
  cattr_accessor :host, :keyspace
  attr_accessor :title, :description, :watched, :version
  attr_accessor :attributes
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
  
  
  
  
  
  def initialize(attrs = {})
    @attributes = attrs
  end

  def save
    
  end
  
  def save!
    
  end
  
  def destroy
    
  end
end