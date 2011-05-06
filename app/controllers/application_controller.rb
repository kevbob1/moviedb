class ApplicationController < ActionController::Base
  protect_from_forgery

	def home
    @movies = Movie.all
	end
end
