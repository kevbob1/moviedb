class MovieProjector #< Sequent::Core::Projector
	on MovieCreated do |event|
    create_record(
      MovieRecord,
      aggregate_id: event.aggregate_id,
      name: event.name,
      description: event.description,
    )
  end

  on MovieEdited do |event|
    update_record(MovieRecord, event) do |record|
      record.name = event.name
      record.description = event.description
    end
  end

  on MovieDeleted do |event|
    movie = get_record(MovieRecord, aggregate_id: event.aggregate_id)
    delete_record(MovieRecord, movie)
  end
end
