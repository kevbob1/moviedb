# frozen_string_literal: true

unless Rails.env.test?
  if ENV["TMDB_API_KEY"].blank?
    Rails.logger.warn("[TMDB] TMDB_API_KEY is not set. TMDB integration will not work until a valid API key is configured.")
  end
end
