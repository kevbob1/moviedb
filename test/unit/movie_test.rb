require 'test_helper'

class MovieTest < ActiveSupport::TestCase
  include ActiveModel::Lint::Tests
  
  def setup
    @model = Movie.new
  end
  
  test 'create destroy' do
    @model.title = 'test1'
    @model.description = 'test1'
    @model.watched = false
    @model.save
    mymodel = Movie.find 'test1'
    assert_not_nil mymodel
    
    @model.destroy
    mymodel = Movie.find 'test1'

    assert_nil mymodel

  end
end
