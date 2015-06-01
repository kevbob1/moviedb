define ['backbone'], (Backbone) ->
    
   class Users extends Backbone.Collection
      url: '/users'

   Users
