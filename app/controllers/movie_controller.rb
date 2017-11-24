class MovieController < ApplicationController

	def index
	end

  def new
    @command = CreateMovie.new(
			aggregate_id: Sequent.new_uuid
    )
  end

  def create
    @command = CreateMovie.from_params(create_movie_params)

    begin
      Sequent.command_service.execute_commands(@command)
      redirect_to invoice_index_path
    rescue Sequent::Core::CommandNotValid
      render :new # render same page and display error
    end
  end

  def create_movie_params
    params.require(:create_movie).permit(:aggregate_id, :amount, recipient: [:name])
  end
end
