// Place your application-specific JavaScript functions and classes here
// This file is automatically included by javascript_include_tag :defaults

function movie_update_handler(version, request) {


  var new_version = JSON.parse(request.responseText);
	if (new_version != version) {

var growl_id = Growl4Rails.showGrowl({image_path: '', title: "item updated to version " + new_version, message:"document updated."});

  document.observe(growl_id + ':clicked', function(event) {
    console.log('Growl %s was clicked.', Event.findElement(event).id);
  });
	}
}