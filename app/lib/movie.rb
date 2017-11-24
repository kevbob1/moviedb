class Movie < Sequent::Core::AggregateRoot

  def initialize(id, name, description)
    super(id)
    apply MovieCreated, name: name, description: description
  end

  def edit(name, description)
    apply MovieEdited, name: name, description: description 
  end

  def load_from_history(stream, events)
    raise "Empty history" if events.empty?
    super
  end

  protected
  # called by apply. Here we can put in the organization_id for all
  # aggregate roots needing the tenant_id
  def build_event(event, params = {})
    super
  #  super(event, params.merge({: @tenant_id}))
  end

  private 

  on MovieCreated do |event|
    @name = event.name
    @description = event.description
  end

  on MovieEdited do |event|
    @name = event.name
    @description = event.description
  end
end
