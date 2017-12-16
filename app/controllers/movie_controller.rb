class MovieController < ApplicationController

	def index
	end

  def new
    @command = CreateMovie.new(
      aggregate_id: Sequent.new_uuid
    )
  end

  def edit
    m = MovieRecord.find_by_aggregate_id params[:id]
    @command = EditMovie.new(
      aggregate_id: m.aggregate_id,
      name:  m.name,
      description: m.description
    )

  end

  def create
    @command = CreatedMovie.from_params(create_movie_params)

    begin
      Sequent.command_service.execute_commands(@command)
      redirect_to movie_index_path
    rescue Sequent::Core::CommandNotValid
      render :new # render same page and display error
    end
  end

  def update
    @command = EditMovie.from_params(edit_movie_params)
    
        begin
          Sequent.command_service.execute_commands(@command)
          redirect_to movie_index_path
        rescue Sequent::Core::CommandNotValid
          render :new # render same page and display error
        end
  end

  def destroy
    @command = DeleteMovie.new(aggregate_id: params[:id])
    #begin
      Sequent.command_service.execute_commands(@command)
      redirect_to movie_index_path
    #rescue Sequent::Core::CommandNotValid
    #  redirect_to movie_index_path
    #end 
  end


  def create_movie_params
    params.require(:create_movie).permit(:aggregate_id, :name, :description)
  end

  def edit_movie_params
    params.require(:edit_movie).permit(:aggregate_id, :name, :description)
  end


end
