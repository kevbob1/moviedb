class MovieCommandHandler <  Sequent::Core::BaseCommandHandler
	on CreateMovie do |command|
		
				repository.add_aggregate Movie.new(
					command.aggregate_id,
					command.name,
					command.description
				)
			end	
	
	
end