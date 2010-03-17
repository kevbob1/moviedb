
class Movie < MongoRecord::Base
  collection_name :movies
  fields :title, :watched

	def watched_with_cast
		val = watched_without_cast
		if val.nil?
			val
		elsif val.to_i == 1
			true
		else
			false
		end
	end


	alias_method_chain :watched, :cast

	def errors
		@errors ||= ActiveResource::Errors.new(self)
	end
end

