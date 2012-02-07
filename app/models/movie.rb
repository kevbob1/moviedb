class Movie < ActiveColumn::Base
	
  key :user_id
  attr_accessor :user_id, :message	
	
	def all
		result = []
		ActiveColumn.connection.each do |(key,)|
			
		end
		return result
	end
end