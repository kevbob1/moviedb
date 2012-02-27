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

    assert @model.save
    mymodel = Movie.find @model.id
    assert_not_nil mymodel
    assert_not_nil mymodel.created_at
    assert_not_nil mymodel.updated_at
    
    saved_key = @model.id
    @model.destroy
    mymodel = Movie.find saved_key

    assert_nil mymodel
  end

  test 'update increments version' do
    @model.title = 'test1'
    @model.description = 'test1'
    @model.watched = false

    assert @model.save
    
    assert_equal(1, @model.version)
    
    @model.description = "test22"
    @model.save
    assert_equal(2, @model.version)
    @model.destroy
  end
end
