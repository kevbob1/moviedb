
class CreateMovie #< Sequent::Core::Command
  include MovieCommand

	attrs name: String, description: String

  validates_presence_of :name
  validates_presence_of :description

end
