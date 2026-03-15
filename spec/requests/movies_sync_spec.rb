# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Movies Sync from TMDB", type: :request do
  let(:movie_data) do
    {
      tmdb_id: 550,
      title: "Fight Club",
      description: "An insomniac office worker and a devil-may-care soap maker form an underground fight club.",
      release_date: 1999,
      poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      vote_average: 8.4,
      genres: "Drama, Thriller"
    }
  end

  describe "POST /movies/sync_from_tmdb" do
    context "when sync succeeds and movie is new" do
      before do
        allow_any_instance_of(TmdbService).to receive(:fetch_movie).with(550).and_return(movie_data)
        allow_any_instance_of(KafkaProducerService).to receive(:publish_movie_sync)
      end

      it "creates a new movie and redirects to the movie show page" do
        expect {
          post sync_from_tmdb_movies_path, params: { tmdb_id: 550 }
        }.to change(Movie, :count).by(1)

        movie = Movie.last
        expect(movie.tmdb_id).to eq(550)
        expect(movie.title).to eq("Fight Club")
        expect(response).to redirect_to(movie_path(movie))
        follow_redirect!
        expect(response.body).to include("Fight Club")
      end
    end

    context "when sync succeeds and movie already exists (duplicate tmdb_id)" do
      before do
        allow_any_instance_of(TmdbService).to receive(:fetch_movie).with(550).and_return(movie_data)
        allow_any_instance_of(KafkaProducerService).to receive(:publish_movie_sync)
        Movie.create!(title: "Old Title", tmdb_id: 550)
      end

      it "updates the existing movie without creating a new one" do
        expect {
          post sync_from_tmdb_movies_path, params: { tmdb_id: 550 }
        }.not_to change(Movie, :count)

        movie = Movie.find_by(tmdb_id: 550)
        expect(movie.title).to eq("Fight Club")
        expect(response).to redirect_to(movie_path(movie))
      end
    end

    context "when TmdbService raises NotFoundError" do
      before do
        allow_any_instance_of(TmdbService).to receive(:fetch_movie).with(999999).and_raise(TmdbService::NotFoundError, "Not found")
      end

      it "redirects to movies_path with an alert" do
        post sync_from_tmdb_movies_path, params: { tmdb_id: 999999 }

        expect(response).to redirect_to(movies_path)
        follow_redirect!
        expect(response.body).to include("Not found")
      end
    end

    context "when TmdbService raises ApiKeyError" do
      before do
        allow_any_instance_of(TmdbService).to receive(:fetch_movie).with(550).and_raise(TmdbService::ApiKeyError, "Invalid API key")
      end

      it "redirects to movies_path with an alert" do
        post sync_from_tmdb_movies_path, params: { tmdb_id: 550 }

        expect(response).to redirect_to(movies_path)
        follow_redirect!
        expect(response.body).to include("Invalid API key")
      end
    end

    context "when TmdbService raises a generic Error" do
      before do
        allow_any_instance_of(TmdbService).to receive(:fetch_movie).with(550).and_raise(TmdbService::Error, "TMDB API error")
      end

      it "redirects to movies_path with an alert" do
        post sync_from_tmdb_movies_path, params: { tmdb_id: 550 }

        expect(response).to redirect_to(movies_path)
        follow_redirect!
        expect(response.body).to include("TMDB API error")
      end
    end
  end
end
