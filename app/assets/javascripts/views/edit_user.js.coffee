define ['jquery','backbone', 'underscore', 'models/user', 'tpl'], ($, Backbone, _, User, tpl) ->

   class EditUser extends Backbone.View
      constructor: (options) ->
         super(options)
         @router = options.router
         
      el: '.page'
      
      events:
        'submit .edit-user-form': 'saveUser',
        'click .delete-user': 'deleteUser'
         
      render: (options) =>
         if options.id
            @user = new User(id: options.id)
            @user.fetch {
               success: (user) =>
                  template = _.template(tpl.get('edit_user'), {user: that.user})
                  @$el.html(template)
            }
         
         else
            template = _.template(tpl.get('edit_user'), {user: null});
            @$el.html(template)    

      saveUser: (ev) =>
        userDetails = $(ev.currentTarget).serializeObject();
        user = new User()
        console.log "saving user " + JSON.stringify(userDetails)
        
        user.save(userDetails, {
            success: (user) =>
                // back to home
                @router.navigate('', {trigger: true});
            
        }
        false

    
      deleteUser: (ev) =>

        @user.destroy {
            success: (user) => 
                // back to home
                @router.navigate('', {trigger: true});
            
        }
        false

    
   EditUser
