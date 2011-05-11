# To change this template, choose Tools | Templates
# and open the template in the editor.

class ImdbService
	
	class ImdbMovie
		def initialize(data)
			@data = data
		end
		
		def title
			@data['Title']
		end
		
		def image_url
			@data['Poster']
		end
		
		def movie_url
			"http://www.imdb.com/title/{@data['ID']}/"
		end
	end
	
  cattr_reader :logger
  @@logger = RAILS_DEFAULT_LOGGER
	
  def initialize(url)
		@url = url
  end

	def parse_response(response_string)
		JSON.parse(response_string)
	end
	
	def search(title)
		# build url
    parts = []
    parts.push(@url)
    parts.push('?t=')
    parts.push(CGI::escape(title))

    url = parts.join

		# make call
    myUrl = URI.parse(url)
    myHTTP = Net::HTTP.new(myUrl.host, myUrl.port)
		
    response = myHTTP.request_get(myUrl.request_uri)
		if (response.code.to_s != '200')
      raise "HTTP Error communicating ease service: " + response.code + " " + response.message
    end

		# parse results
		val = parse_response(response.body)
		
		if val['Response'] != "True"
			logger.info "imdb url: #{url}"
			raise "IMDB error: #{val['Response']}"
		end
		
		val
	end
end
