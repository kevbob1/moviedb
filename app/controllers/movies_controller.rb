class MoviesController < ApplicationController
  before_action :set_movie, only: %i[ show edit update destroy ]

  # GET /movies or /movies.json
  def index
    @pagy, @movies = pagy(:offset, Movie.order(created_at: :desc), limit: 12)
  end

  # GET /movies/1 or /movies/1.json
  def show
  end

  # GET /movies/new
  def new
    @movie = Movie.new
  end

  # GET /movies/1/edit
  def edit
  end

  # POST /movies or /movies.json
  def create
    @movie = Movie.new(movie_params)

    respond_to do |format|
      if @movie.save
        format.html { redirect_to @movie, notice: "Movie was successfully created." }
        format.json { render :show, status: :created, location: @movie }
      else
        format.html { render :new, status: :unprocessable_entity }
        format.json { render json: @movie.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /movies/1 or /movies/1.json
  def update
    respond_to do |format|
      if @movie.update(movie_params)
        format.html { redirect_to @movie, notice: "Movie was successfully updated." }
        format.json { render :show, status: :ok, location: @movie }
      else
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: @movie.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /movies/1 or /movies/1.json
  def destroy
    @movie.destroy!

    respond_to do |format|
      format.html { redirect_to movies_path, status: :see_other, notice: "Movie was successfully destroyed." }
      format.json { head :no_content }
    end
  end

  # POST /movies/sync_from_tmdb
  def sync_from_tmdb
    tmdb_id = params[:tmdb_id]
    movie_data = TmdbService.new.fetch_movie(tmdb_id.to_i)
    @movie = Movie.find_or_initialize_by(tmdb_id: movie_data[:tmdb_id])
    @movie.assign_attributes(
      title: movie_data[:title],
      description: movie_data[:description],
      release_date: movie_data[:release_date],
      poster_path: movie_data[:poster_path],
      vote_average: movie_data[:vote_average],
      genres: movie_data[:genres]
    )
    @movie.save!

    action = @movie.previously_new_record? ? :created : :updated
    begin
      KafkaProducerService.new.publish_movie_sync(@movie, action: action)
    rescue KafkaProducerService::Error => e
      Rails.logger.error("Kafka publish failed for movie #{@movie.id}: #{e.message}")
    end

    respond_to do |format|
      format.html { redirect_to @movie, notice: "Movie '#{@movie.title}' synced from TMDB." }
      format.json { render json: @movie, status: :ok }
    end
  rescue TmdbService::NotFoundError => e
    respond_to do |format|
      format.html { redirect_to movies_path, alert: e.message }
      format.json { render json: { error: e.message }, status: :not_found }
    end
  rescue TmdbService::ApiKeyError => e
    respond_to do |format|
      format.html { redirect_to movies_path, alert: e.message }
      format.json { render json: { error: e.message }, status: :unauthorized }
    end
  rescue TmdbService::Error => e
    respond_to do |format|
      format.html { redirect_to movies_path, alert: e.message }
      format.json { render json: { error: e.message }, status: :service_unavailable }
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_movie
      @movie = Movie.find(params[:id])
    end

    # Only allow a list of trusted parameters through.
    def movie_params
      params.require(:movie).permit(:title, :description, :release_date, :tmdb_id, :poster_path, :vote_average, :genres)
    end
end
