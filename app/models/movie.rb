
class Movie < MongoRecord::Base
  collection_name :movies
  fields :title, :watched, :version

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

	def save_with_version
		RAILS_DEFAULT_LOGGER.debug "save called: #{self.id}"
		if self.version.nil?
			self.version = 1
		else
			self.version = self.version + 1
		end

		save_without_version
	end

	alias_method_chain :save, :version

	def update_attributes_with_stuff(attributes)
		attributes.each do |name, value|
			self[name] = value
		end
		save
  end

	alias_method_chain :update_attributes, :stuff
end

