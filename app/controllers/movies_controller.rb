class MoviesController < ApplicationController
  # GET /movies
  # GET /movies.json
  def index

		if !params[:s].blank?
			@movies = Movie.find_by_title params[:s]
		else
	    @movies = Movie.all
		end

    respond_to do |format|
      format.html # index.html.erb
      format.json { render :json => @movies }
      format.xml { render :xml => @movies }
    end
  end
	
  # GET /movies/1
  # GET /movies/1.json
  def show
    @movie = Movie.find(params[:id])

    respond_to do |format|
      format.html # show.html.erb
      format.json { render :json => @movie }
      format.xml { render :xml => @movie }
    end
  end

  # GET /movies/new
  # GET /movies/new.json
  def new
    @movie = Movie.new

    respond_to do |format|
      format.html # new.html.erb
      format.json { render :json => @movie }
      format.xml { render :xml => @movie }
    end
  end

  # GET /movies/1/edit
  def edit
    @movie = Movie.find(params[:id])
  end

  # POST /movies
  # POST /movies.json
  def create
    
    if params[:movie][:watched] == '1'
      params[:movie][:watched] = true
    else
      params[:movie][:watched] = false
    end
    
    @movie = Movie.new(params[:movie])

    respond_to do |format|
      if @movie.save
        format.html { redirect_to @movie, :notice => 'Movie was successfully created.' }
        format.json { render :json => @movie, :status => :created, :location => @movie }
        format.xml { render :xml => @movie, :status => :created, :location => @movie }
        
      else
        format.html { render :action => "new" }
        format.json { render :json => @movie.errors, :status => :unprocessable_entity }
        format.xml { render :xml => @movie.errors, :status => :unprocessable_entity }
        
      end
    end
  end

  # PUT /movies/1
  # PUT /movies/1.json
  def update
    @movie = Movie.find(params[:id])

    if params[:movie][:watched] == '1'
      params[:movie][:watched] = true
    else
      params[:movie][:watched] = false
    end    
    
    respond_to do |format|
      if @movie.update_attributes(params[:movie])
        format.html { redirect_to @movie, :notice => 'Movie was successfully updated.' }
        format.json { head :ok }
        format.xml { head :ok }

      else
        format.html { render :action => "edit" }
        format.json { render :json => @movie.errors, :status => :unprocessable_entity }
        format.xml { render :xml => @movie.errors, :status => :unprocessable_entity }

      end
    end
  end

  # DELETE /movies/1
  # DELETE /movies/1.json
  def destroy
    @movie = Movie.find(params[:id])
    @movie.destroy

    respond_to do |format|
      format.html { redirect_to movies_url }
      format.json { head :ok }
      format.xml { head :ok }
    end
  end
end
