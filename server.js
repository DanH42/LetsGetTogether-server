var express = require('express');
var app = express();
var fs = require('fs');
var marked = require('marked');
var moment = require('moment');

app.use(function(req, res, next){
	var data = '';
	req.setEncoding('utf8');
	req.on('data', function(chunk){
		data += chunk;
	});
	req.on('end', function(){
		try{
			req.json = JSON.parse(req.body);
		}catch(e){
			req.json = {};
		}

		next();
	});
});

app.use(function(req, res, next){
	res.sendError = function(err){
		res.send({error: err});
	}

	next();
});

app.listen(8800, '127.0.0.1');

var mongo = new (require("mongolian"))({log:{debug:function(){}}}).db("get2gether");
var db = {
	apps: mongo.collection("apps"),
	users: mongo.collection("users"),
	logins: mongo.collection("logins"),
	reviews: mongo.collection("reviews")
};

app.get('/api', function(req, res){
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

function checkAuth(req, res, callback){
	if(!req.json.apiKey)
		return res.sendError(res, "No API key supplied");

	db.apps.findOne({key: req.json.apiKey}, function(err, app){
		if(!err && app){
			if(!app.isDisabled)
				callback();
			else
				res.sendError("Your API access has been disabled");
		}else
			res.sendError("Invalid API key supplied");
	});
}
var guid = (function(){
	function s4(){
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	}

	return function(){
		return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
	};
})();

app.get('/api/createApp', function(req, res){
	var key = guid();

	// Asynchronous, but this is temporary anyway
	db.apps.insert({
		name: "Randomly generated temporary app",
		key: key,
		isDisabled: false
	});

	res.send({key: key});
});

app.get('/api/checkAuth', function(req, res){
	checkAuth(req, res, function(){
		res.send({success: true});
	});
});
