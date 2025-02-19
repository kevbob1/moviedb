class MovieCommandHandler # <  Sequent::Core::BaseCommandHandler
	on CreateMovie do |command|
		
				repository.add_aggregate Movie.new(
					command.aggregate_id,
					command.name,
					command.description
				)
	end	
	
	on EditMovie do |command|

		do_with_aggregate(command, Movie) do |movie|
			movie.edit(command.name, command.description)
		end
	end
	
	on DeleteMovie do |command|
		do_with_aggregate(command, Movie) do |movie|
			movie.delete
		end

	end
end
