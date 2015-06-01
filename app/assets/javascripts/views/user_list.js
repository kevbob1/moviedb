define(['jquery', 'backbone', 'underscore', 'collections/users', 'models/user', 'tpl'], function($, Backbone, _, Users, User, tpl ) {
    

var UserList = Backbone.View.extend({
    initialize: function(options) {
        this.router = options.router;
    },
    
    el: '.page',
    
    events: {
        'click .delete-listed-user': 'deleteUser'
    },

    render: function() {
        var that = this;
        var users = new Users();
        users.fetch({
            success: function(users_) {
                var template = _.template(tpl.get('users_list'), {users: users_.models});
                
                that.$el.html(template);
            }
        })
    },
    
    deleteUser: function(ev) {
        var that = this;
        var userId = parseInt($(ev.currentTarget).data()["userId"]);
        var user = new User({id: userId});


        user.destroy({
            success: function(user) {
                // re-render view
                that.render();
            }
        });
        return false;
    }
});

return UserList;

});