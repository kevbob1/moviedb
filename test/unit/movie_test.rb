require 'test_helper'

class MovieTest < ActiveSupport::TestCase
  include ActiveModel::Lint::Tests
  
  def setup
    @model = Movie.new
  end
  
  
end
