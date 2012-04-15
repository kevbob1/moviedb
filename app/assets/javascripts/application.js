// This is a manifest file that'll be compiled into application.js, which will include all the files
// listed below.
//
// Any JavaScript/Coffee file within this directory, lib/assets/javascripts, vendor/assets/javascripts,
// or vendor/assets/javascripts of plugins, if any, can be referenced here using a relative path.
//
// It's not advisable to add code directly here, but if you do, it'll appear at the bottom of the
// the compiled file.
//
// WARNING: THE FIRST BLANK LINE MARKS THE END OF WHAT'S TO BE PROCESSED, ANY BLANK LINE SHOULD
// GO AFTER THE REQUIRES BELOW.
//
//= require jquery
//= require jquery_ujs
//= require gritter
// require private_pub
//= require_tree .

/* for the light (white) version of the gritter notice */
.gritter-light .gritter-item,
.gritter-light .gritter-bottom,
.gritter-light .gritter-top,
.gritter-close {
    background-image: url(../images/gritter-light.png);
    color: #222;
}
.gritter-light .gritter-title {
    text-shadow: none;
}