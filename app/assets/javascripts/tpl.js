define([ "jquery" ], function($) {
   var tpl = {

      templates : {},

      loadTemplates : function(names, callback) {
         var that = this;
         
         var loadTemplate = function (index) {
            var name = names[index];
            console.log('Loading template: ' + name);
            $.get('assets/templates/' + name + '.html', function (data) {
               that.templates[name] = data;
               index++;
               if (index < names.length) {
                  loadTemplate(index);
               } else {
                  callback();
               }
            });
         }
         
         loadTemplate(0);
      },

      get:function (name) {
         return this.templates[name];
      }
   }

   return tpl;
});