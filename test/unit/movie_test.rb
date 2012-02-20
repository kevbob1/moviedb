require 'test_helper'

class MovieTest < ActiveSupport::TestCase
  #include ActiveModel::Lint::Tests
  
  def setup
    @model = Movie.new
  end
  
  test 'create destroy' do
    @model.title = 'test1'
    @model.description = 'test1'
    @model.watched = false
    @model.version = 1
    @model.save
    mymodel = Movie.find 'test1'
    assert_not_nil mymodel
    assert_not_nil mymodel.created_at
    assert_not_nil mymodel.updated_at
    
    
    @model.destroy
    mymodel = Movie.find 'test1'

    assert_nil mymodel

  end
end
