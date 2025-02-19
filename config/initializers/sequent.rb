#require 'sequent/support'

#module SequentApp
  #VERSION = 1

  #VIEW_PROJECTION = Sequent::Support::ViewProjection.new(
  #  name: "view",
  #  version: VERSION,
  #  definition: "db/view_schema.rb",
  #  event_handlers: [
  #    MovieProjector.new
  #  ]
  #)
  #DB_CONFIG = YAML.load(ERB.new(File.read('config/database.yml')).result)
#end


#Sequent.configure do |config|
  ### App configurations

  # Command handler classes
  #config.command_handlers = [MovieCommandHandler.new]

  # Optional filters, can be used to do for instance security checks.
  #config.command_filters = []

  # Event handler classes
  #config.event_handlers = [MovieProjector.new]


  #### Configured by default but can be overridden:

  # config.event_store
  # config.command_service
  # config.record_class

  # How to handle transactions
  #config.transaction_provider = Sequent::Core::Transactions::ActiveRecordTransactionProvider.new
#end
