var express = require('express');
var app = express();
var fs = require('fs');
var marked = require('marked');
var moment = require('moment');
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;

// These credentials shouldn't really be stored here, but meh
passport.use(new FacebookStrategy({
		clientID: "175237175154",
		clientSecret: "9e29a1dba3c5d2ccaec27f543848dbf2",
		callbackURL: "https://get2gether.me/api/auth/facebook/callback"
	}, function(accessToken, refreshToken, profile, done){
		db.users.findOne({id: profile.id}, function(err, user){
			if(!err && user)
				return done(null, user);

			var newUser = {
				id: profile.id,
				name: profile.displayName,
				image: "https://graph.facebook.com/" + profile.id + "/picture?width=100&height=100"
			};
			db.users.insert(newUser);
			done(null, newUser);
		});
	}
));

// Add req.json to all incoming requests to easily process data
app.use(function(req, res, next){
	var data = '';
	req.setEncoding('utf8');
	req.on('data', function(chunk){
		data += chunk;
	});
	req.on('end', function(){
		try{
			req.json = JSON.parse(data);
		}catch(e){
			req.json = {};
		}

		next();
	});
});

// Add a res.sendError function to all requests
app.use(function(req, res, next){
	res.sendError = function(err){
		res.send({error: err});
	}
});

app.listen(8800, '127.0.0.1');

// Initialize database connection
var mongo = new (require("mongolian"))({log:{debug:function(){}}}).db("get2gether");
var db = {
	apps: mongo.collection("apps"),
	users: mongo.collection("users"),
	reviews: mongo.collection("reviews")
};

// If someone simply requests /api, render the readme as HTML
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

app.get('/api/auth/facebook', passport.authenticate('facebook', {session: false}));

app.get('/api/auth/facebook/callback', passport.authenticate('facebook', {
	failureRedirect: '/#/authFailure',
	session: false
}), function(req, res){
	// This should be a real, temporary access token. Instead, it's 4 random 
	// numbers hung on the front of the user's ID.
	res.redirect('/#/auth/' + s4() + req.user.id);
});

function s4(){
	return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
}

function guid(){
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

// The supplied callback will be called only if the request contains a valid
// user access token. Otherwise, an error will be sent as a response.
function authUser(req, res, callback){
	if(!req.json.token)
		return res.sendError("No user access token supplied");

	// Again, this should actually be checked. Instead, we just strip out the
	// first 4 characters and see if that user ID exists in the database.
	var userID = req.json.token.substr(4);
	db.users.findOne({id: userID}, function(err, user){
		if(err || !user)
			return res.sendError("Invalid access token");
		callback(user);
	});
}

// The supplied callback will be called only if the request contains a valid
// and active API key. Otherwise, an error will be sent as a response.
function checkAuth(req, res, callback){
	if(!req.json.apiKey)
		return res.sendError("No API key supplied");

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

// Given the access token of a logged-in user, get their account details
app.post('/api/getUserData', function(req, res){
	authUser(req, res, function(user){
		res.send(user);
	});
});

// Temporary way to create an API key. This should be replaced with something
// more robust and less prone to collisions
app.all('/api/createApp', function(req, res){
	// This key is randomly generated, and NOT checked for uniqueness
	var key = guid();

	// Asynchronous, but this is temporary anyway
	db.apps.insert({
		name: "Randomly generated temporary app",
		key: key,
		isDisabled: false
	});

	res.send({apiKey: key});
});

app.post('/api/checkAuth', function(req, res){
	checkAuth(req, res, function(){
		res.send({success: true});
	});
});
