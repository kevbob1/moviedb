require 'test_helper'
require 'imdb_service'

class ImdbServiceTest < ActiveSupport::TestCase
  # Replace this with your real tests.
	
	instring = '{"Title":"Finding Nemo","Year":"2003","Rated":"G","Released":"30 May 2003","Genre":"Animation, Adventure, Comedy, Family","Director":"Andrew Stanton, Lee Unkrich","Writer":"Andrew Stanton, Andrew Stanton","Actors":"Albert Brooks, Ellen DeGeneres, Alexander Gould, Willem Dafoe","Plot":"A father-son underwater adventure featuring Nemo, a boy clownfish, stolen from his coral reef home. His timid father must then travel to Sydney and search Sydney Harbour to find Nemo.","Poster":"http://ia.media-imdb.com/images/M/MV5BMTc5NjExNTA5OV5BMl5BanBnXkFtZTYwMTQ0ODY2._V1._SX320.jpg","Runtime":"1 hr 40 mins","Rating":"8.2","Votes":"179159","ID":"tt0266543","Response":"True"}'
	
  test "parse response" do
    i = ImdbService.new(nil)
		
		out = i.parse_response(instring)
		
		if !out.is_a?(Hash)
			fail("out is not a hash")
		else
			puts out.inspect
		end
  end
end
