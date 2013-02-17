require 'test_helper'

class MovieTest < ActiveSupport::TestCase
  include ActiveModel::Lint::Tests
  
  def setup
    @model = Movie.new
    
#    raise "need to load test fixtures"
    
  end
  
  test 'find by id' do
    @model = Movie.find '61aa82d0-5ae1-0130-3e61-0015c5cb5473'
    assert_equal 'Free Whilly', @model.title
  end
  
	test 'find by title' do
		
		# @model.title = "test1"
		# @model.description = "test1"
		# @model.watched = false
		# @model.save
# 
    # @model = Movie.new
		# @model.title = "test2"
		# @model.description = "test2"
		# @model.watched = false
		# @model.save
# 
    # @model = Movie.new
		# @model.title = "test3"
		# @model.description = "test3"
		# @model.watched = false
		# @model.save
		
		models = Movie.find_by_title "test"
		assert_equal 3, models.size
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
