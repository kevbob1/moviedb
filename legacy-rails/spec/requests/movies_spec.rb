# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Movies", type: :request do
  let(:valid_attributes) do
    { title: "The Matrix", description: "A computer hacker learns about the true nature of reality.", release_date: 1999 }
  end

  let(:invalid_attributes) do
    { title: "", description: "Missing title movie", release_date: 2000 }
  end

  # ── HTML Format ──────────────────────────────────────────────────────

  describe "HTML format" do
    describe "GET /movies" do
      it "returns a successful response" do
        create(:movie)
        get movies_path
        expect(response).to have_http_status(:ok)
      end
    end

    describe "GET /movies/:id" do
      it "returns a successful response" do
        movie = create(:movie)
        get movie_path(movie)
        expect(response).to have_http_status(:ok)
      end
    end

    describe "GET /movies/new" do
      it "returns a successful response" do
        get new_movie_path
        expect(response).to have_http_status(:ok)
      end
    end

    describe "GET /movies/:id/edit" do
      it "returns a successful response" do
        movie = create(:movie)
        get edit_movie_path(movie)
        expect(response).to have_http_status(:ok)
      end
    end

    describe "POST /movies" do
      context "with valid parameters" do
        it "creates a new Movie and redirects" do
          expect {
            post movies_path, params: { movie: valid_attributes }
          }.to change(Movie, :count).by(1)

          expect(response).to have_http_status(:found)
          expect(response).to redirect_to(movie_path(Movie.last))
        end
      end

      context "with invalid parameters" do
        it "does not create a Movie and returns unprocessable entity" do
          expect {
            post movies_path, params: { movie: invalid_attributes }
          }.not_to change(Movie, :count)

          expect(response).to have_http_status(:unprocessable_entity)
        end
      end
    end

    describe "PATCH /movies/:id" do
      context "with valid parameters" do
        it "updates the movie and redirects" do
          movie = create(:movie)
          patch movie_path(movie), params: { movie: { title: "Updated Title" } }

          expect(response).to have_http_status(:found)
          expect(response).to redirect_to(movie_path(movie))
          expect(movie.reload.title).to eq("Updated Title")
        end
      end

      context "with invalid parameters" do
        it "does not update the movie and returns unprocessable entity" do
          movie = create(:movie, title: "Original Title")
          patch movie_path(movie), params: { movie: invalid_attributes }

          expect(response).to have_http_status(:unprocessable_entity)
          expect(movie.reload.title).to eq("Original Title")
        end
      end
    end

    describe "DELETE /movies/:id" do
      it "destroys the movie and redirects to index" do
        movie = create(:movie)

        expect {
          delete movie_path(movie)
        }.to change(Movie, :count).by(-1)

        expect(response).to have_http_status(:see_other)
        expect(response).to redirect_to(movies_path)
      end
    end
  end

  # ── JSON Format ──────────────────────────────────────────────────────

  describe "JSON format" do
    describe "GET /movies.json" do
      it "returns a JSON array of movies" do
        create_list(:movie, 3)
        get movies_path(format: :json)

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to match(%r{application/json})

        json = JSON.parse(response.body)
        expect(json).to be_an(Array)
        expect(json.length).to eq(3)
      end

      it "includes expected movie attributes in each element" do
        movie = create(:movie)
        get movies_path(format: :json)

        json = JSON.parse(response.body)
        entry = json.first

        expect(entry).to include(
          "id" => movie.id,
          "title" => movie.title,
          "description" => movie.description,
          "release_date" => movie.release_date
        )
      end
    end

    describe "GET /movies/:id.json" do
      it "returns a JSON object for the movie" do
        movie = create(:movie)
        get movie_path(movie, format: :json)

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to match(%r{application/json})

        json = JSON.parse(response.body)
        expect(json).to include(
          "id" => movie.id,
          "title" => movie.title,
          "description" => movie.description,
          "release_date" => movie.release_date
        )
      end
    end

    describe "POST /movies.json" do
      context "with valid parameters" do
        it "creates a movie and returns 201 with the movie JSON" do
          expect {
            post movies_path(format: :json), params: { movie: valid_attributes }
          }.to change(Movie, :count).by(1)

          expect(response).to have_http_status(:created)
          expect(response.content_type).to match(%r{application/json})

          json = JSON.parse(response.body)
          expect(json["title"]).to eq("The Matrix")
          expect(json["description"]).to eq("A computer hacker learns about the true nature of reality.")
          expect(json["release_date"]).to eq(1999)
        end
      end

      context "with invalid parameters" do
        it "does not create a movie and returns 422 with errors" do
          expect {
            post movies_path(format: :json), params: { movie: invalid_attributes }
          }.not_to change(Movie, :count)

          expect(response).to have_http_status(:unprocessable_entity)
          expect(response.content_type).to match(%r{application/json})

          json = JSON.parse(response.body)
          expect(json).to have_key("title")
          expect(json["title"]).to include("can't be blank")
        end
      end
    end

    describe "PATCH /movies/:id.json" do
      context "with valid parameters" do
        it "updates the movie and returns 200" do
          movie = create(:movie)
          patch movie_path(movie, format: :json), params: { movie: { title: "Updated Title" } }

          expect(response).to have_http_status(:ok)
          expect(response.content_type).to match(%r{application/json})

          json = JSON.parse(response.body)
          expect(json["title"]).to eq("Updated Title")
          expect(movie.reload.title).to eq("Updated Title")
        end
      end

      context "with invalid parameters" do
        it "does not update the movie and returns 422 with errors" do
          movie = create(:movie, title: "Original Title")
          patch movie_path(movie, format: :json), params: { movie: invalid_attributes }

          expect(response).to have_http_status(:unprocessable_entity)
          expect(response.content_type).to match(%r{application/json})

          json = JSON.parse(response.body)
          expect(json).to have_key("title")
          expect(movie.reload.title).to eq("Original Title")
        end
      end
    end

    describe "DELETE /movies/:id.json" do
      it "destroys the movie and returns 204 no content" do
        movie = create(:movie)

        expect {
          delete movie_path(movie, format: :json)
        }.to change(Movie, :count).by(-1)

        expect(response).to have_http_status(:no_content)
      end
    end
  end
end
