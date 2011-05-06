
class Movie
	include Ripple::Document
	property :title, String, :presence => true
	property :watched, Boolean, :default => proc { false }

	def id
		key
	end

	def version
		1
	end
end
