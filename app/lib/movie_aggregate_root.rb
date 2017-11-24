class MovieAggregateRoot < Sequent::Core::AggregateRoot

  def initialize(id)
    super(id)
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
 #   super(event, params.merge({tenant_id: @tenant_id}))
  end
end
