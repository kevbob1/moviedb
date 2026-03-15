# frozen_string_literal: true

require "rails_helper"

RSpec.describe TmdbService do
  subject(:service) { described_class.new(api_key: "test-api-key") }

  let(:tmdb_id) { 550 }
  let(:base_url) { "https://api.themoviedb.org/3/movie/#{tmdb_id}" }

  let(:success_body) do
    {
      "id" => 550,
      "title" => "Fight Club",
      "overview" => "An insomniac office worker and a devil-may-care soap maker form an underground fight club.",
      "release_date" => "1999-10-15",
      "poster_path" => "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
      "vote_average" => 8.4,
      "genres" => [
        { "id" => 18, "name" => "Drama" },
        { "id" => 53, "name" => "Thriller" }
      ]
    }
  end

  describe "#fetch_movie" do
    context "when the API returns a 200 response with full movie data" do
      before do
        stub_request(:get, base_url)
          .with(query: { api_key: "test-api-key" })
          .to_return(
            status: 200,
            body: success_body.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns a hash with correct keys and values" do
        result = service.fetch_movie(tmdb_id)

        expect(result).to eq(
          tmdb_id: 550,
          title: "Fight Club",
          description: "An insomniac office worker and a devil-may-care soap maker form an underground fight club.",
          release_date: 1999,
          poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
          vote_average: 8.4,
          genres: "Drama, Thriller"
        )
      end

      it "returns release_date as an integer year" do
        result = service.fetch_movie(tmdb_id)
        expect(result[:release_date]).to be_an(Integer)
        expect(result[:release_date]).to eq(1999)
      end
    end

    context "when the API returns a 404 response" do
      before do
        stub_request(:get, base_url)
          .with(query: { api_key: "test-api-key" })
          .to_return(
            status: 404,
            body: { "status_message" => "The resource you requested could not be found." }.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "raises TmdbService::NotFoundError" do
        expect { service.fetch_movie(tmdb_id) }.to raise_error(TmdbService::NotFoundError)
      end
    end

    context "when the API returns a 401 response" do
      before do
        stub_request(:get, base_url)
          .with(query: { api_key: "test-api-key" })
          .to_return(
            status: 401,
            body: { "status_message" => "Invalid API key." }.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "raises TmdbService::ApiKeyError" do
        expect { service.fetch_movie(tmdb_id) }.to raise_error(TmdbService::ApiKeyError)
      end
    end

    context "when the API returns a 500 response" do
      before do
        stub_request(:get, base_url)
          .with(query: { api_key: "test-api-key" })
          .to_return(
            status: 500,
            body: { "status_message" => "Internal error." }.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "raises TmdbService::Error" do
        expect { service.fetch_movie(tmdb_id) }.to raise_error(TmdbService::Error)
      end
    end

    context "when genres is nil in the 200 response" do
      before do
        body = success_body.merge("genres" => nil)
        stub_request(:get, base_url)
          .with(query: { api_key: "test-api-key" })
          .to_return(
            status: 200,
            body: body.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns nil for genres" do
        result = service.fetch_movie(tmdb_id)
        expect(result[:genres]).to be_nil
      end
    end

    context "when genres is an empty array in the 200 response" do
      before do
        body = success_body.merge("genres" => [])
        stub_request(:get, base_url)
          .with(query: { api_key: "test-api-key" })
          .to_return(
            status: 200,
            body: body.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns nil for genres" do
        result = service.fetch_movie(tmdb_id)
        expect(result[:genres]).to be_nil
      end
    end

    context "when release_date is nil in the 200 response" do
      before do
        body = success_body.merge("release_date" => nil)
        stub_request(:get, base_url)
          .with(query: { api_key: "test-api-key" })
          .to_return(
            status: 200,
            body: body.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns nil for release_date" do
        result = service.fetch_movie(tmdb_id)
        expect(result[:release_date]).to be_nil
      end
    end
  end
end
