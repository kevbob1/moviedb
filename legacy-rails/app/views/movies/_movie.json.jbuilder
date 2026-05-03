json.extract! movie, :id, :title, :description, :release_date, :tmdb_id, :poster_path, :vote_average, :genres, :created_at, :updated_at
json.url movie_url(movie, format: :json)
