# frozen_string_literal: true

require "httparty"

class TmdbService
  BASE_URL = "https://api.themoviedb.org/3"

  class Error < StandardError; end
  class NotFoundError < Error; end
  class ApiKeyError < Error; end

  def initialize(api_key: ENV.fetch("TMDB_API_KEY", nil))
    @api_key = api_key
  end

  def fetch_movie(tmdb_id)
    response = HTTParty.get(
      "#{BASE_URL}/movie/#{tmdb_id}",
      query: { api_key: @api_key }
    )

    case response.code
    when 200
      parse_movie_response(response.parsed_response)
    when 401
      raise ApiKeyError, "Invalid or missing TMDB API key"
    when 404
      raise NotFoundError, "Movie with TMDB ID #{tmdb_id} not found"
    else
      raise Error, "TMDB API error: HTTP #{response.code}"
    end
  end

  private

  def parse_movie_response(data)
    genres = if data["genres"].is_a?(Array) && data["genres"].any?
               data["genres"].map { |g| g["name"] }.join(", ")
             end

    release_year = data["release_date"]&.split("-")&.first&.to_i
    release_year = nil if release_year&.zero?

    {
      tmdb_id: data["id"],
      title: data["title"],
      description: data["overview"],
      release_date: release_year,
      poster_path: data["poster_path"],
      vote_average: data["vote_average"],
      genres: genres
    }
  end
end
