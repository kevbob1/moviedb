
namespace :load do
	desc "load task"
	task :load => :environment do
		
		(1..1000).each do |index|
			movie = Movie.new
			movie.title = "title #{index}"
			movie.description = "movie description #{index}"
			movie.watched = ((index % 2) == 0)
			movie.save
		end 
	end
end