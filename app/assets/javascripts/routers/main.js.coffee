define ['backbone', 'views/user_list', 'views/edit_user'], (Backbone, UserList, EditUser) ->

    class MainRouter extends Backbone.Router
        routes:
            '' : 'home',
            'new' : 'newUser',
            'edit/:id' : 'editUser'


    mainRouter = new MainRouter()
    editUserViewInst = new EditUser( router:mainRouter )
    userListViewInst = new UserList( router:mainRouter )
    mainRouter.on 'route:home', ->
        userListViewInst.render()

    mainRouter.on 'route:newUser', ->

        editUserViewInst.render({})

    mainRouter.on 'route:editUser', (id) ->
        editUserViewInst.render(id: id)        

    mainRouter



