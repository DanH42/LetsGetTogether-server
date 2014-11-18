var express = require('express');
var app = express();
var fs = require('fs');
var marked = require('marked');
var moment = require('moment');

app.listen(8800, '127.0.0.1');

app.get('/', function(req, res){
	fs.readFile('README.md', function(err, data){
		if(!err && data){
			marked(data + '', function(err, html){
				if(!err && data)
					res.send(html);
				else
					res.send("Unable to display API docs :(");
			});
		}else
			res.send("Unable to display API docs :(");
	});
});
