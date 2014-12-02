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
				image: "https://graph.facebook.com/" + profile.id + "/picture?width=100&height=100",
				lastCheckIn: 0,
				accuracy: 0,
				location: []
			};
			db.users.insert(newUser);
			done(null, newUser);
		});
	}
));

// Add req.json to all incoming requests to easily process data
app.use(function(req, res, next){
	req.postData = '';
	req.setEncoding('utf8');
	req.on('data', function(chunk){
		req.postData += chunk;
	});
	req.on('end', function(){
		try{
			req.json = JSON.parse(req.postData);
		}catch(e){
			req.json = {};
		}

		next();
	});
});

// Add res.error() and res.success() functions to all requests
app.use(function(req, res, next){
	res.error = function(err){
		logLine(["ERROR", req.path, req.postData, JSON.stringify(err)]);

		res.send({
			success: false,
			error: err
		});
	}

	res.success = function(data){
		logLine(["SUCCESS", req.path, JSON.stringify(req.json), JSON.stringify(data)]);

		res.send({
			success: true,
			data: data
		});
	}

	next();
});

app.listen(8800, '127.0.0.1');

// Initialize database connection
var mongo = new (require("mongolian"))({log:{debug:function(){}}}).db("get2gether");
var db = {
	apps: mongo.collection("apps"),
	users: mongo.collection("users"),
	logins: mongo.collection("logins")
};
// This only needs to be run once, but will be skipped if the index already exists
db.users.ensureIndex({location: "2d"});

var logStream = fs.createWriteStream('api.log', {'flags': 'w'});
function logLine(line){
	var lineStr = moment().format('MMMM Do YYYY, h:mm:ss a') + "\t" + line.join("\t");
	console.log(lineStr);
	logStream.write(lineStr + '\n');
}

// If someone simply requests /api, render the readme as HTML
app.get('/api', function(req, res){
	fs.readFile('README.md', function(err, data){
		if(!err && data){
			marked(data + '', function(err, html){
				if(!err && data){
					fs.readFile('docs.head.html', function(err, head){
						if(!err && head)
							res.send(head + html);
						else
							res.send(html);
					});
				}else
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
	var token = randomToken();
	db.logins.insert({
		id: req.user.id,
		token: token,
		time: moment().unix()
	}, function(){
		res.redirect('/#/auth/' + token);
	});
});

// Return 4 random characters in [0-9a-f]
function s4(){
	return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
}

// Return a v4 pseudo-UUID in the form xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
function guid(){
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

// Return a random access token in the form xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
function randomToken(){
	return s4() + s4() + s4() + s4() + s4() + s4() + s4() + s4() + s4() + s4();
}

// The supplied callback will be called only if the request contains a valid
// user access token. Otherwise, an error will be sent as a response.
function authUser(req, res, callback){
	if(!req.json.token)
		return res.error("No user access token supplied");

	db.logins.findOne({token: req.json.token}, function(err, user){
		if(err || !user)
			return res.error("Invalid access token");
		callback(user);
	});
}

// The supplied callback will be called only if the request contains a valid
// and active API key. Otherwise, an error will be sent as a response.
function checkAuth(req, res, callback){
	if(!req.json.apiKey)
		return res.error("No API key supplied");

	db.apps.findOne({key: req.json.apiKey}, function(err, app){
		if(!err && app){
			if(!app.isDisabled)
				callback();
			else
				res.error("Your API access has been disabled");
		}else
			res.error("Invalid API key supplied");
	});
}

// Only include the fields we really want
function sanitizeUser(user){
	return {
		id: user.id,
		name: user.name,
		image: user.image,
		location: user.location,
		accuracy: user.accuracy,
		lastCheckIn: user.lastCheckIn
	};
}


  ///////////////////////////
 // Logged-in API methods //
///////////////////////////


// Given the access token of a logged-in user, get their account details
app.post('/api/getUserData', function(req, res){
	authUser(req, res, function(user){
		// Only include the fields we really want
		res.success(sanitizeUser(user));
	});
});

// Update the current location of a logged-in user
app.post('/api/checkin', function(req, res){
	authUser(req, res, function(user){
		if(isNaN(req.json.lat + req.json.lng + req.json.accuracy))
			return res.error("Must supply lat, lng, and accuracy as numbers");

		var timestamp = moment().unix();
		if(timestamp - user.lastCheckIn < 10)
			return res.error("You may only check in once every 10 seconds");

		// Update the user's location if they have one, otherwise insert
		db.users.update({
			id: user.id
		}, {
			$set: {
				lastCheckIn: timestamp,
				accuracy: req.json.accuracy,
				location: [req.json.lng, req.json.lat]
			}
		}, function(){
			// Find the 10 nearest users within (about) 20 miles (.3 degrees)
			db.users.find({
				location: {
					$geoWithin: {
						$center:[
							[req.json.lng, req.json.lat], .3
						]
					}
				}
			}).limit(10).toArray(function(err, users){
				if(err)
					return res.error(error);

				var tempUsers = [];
				for(var i = 0; i < users.length; i++){
					var tempUser = users[i];
					if(tempUser.id === user.id)
						continue; // Don't include the current user

					tempUsers.push(sanitizeUser(tempUser));
				}

				res.success({users: tempUsers});
			});
		});
	});
});

// Invalidate the given user token
app.post('/api/logout', function(req, res){
	// By authorizing the user, we know the given token is valid
	authUser(req, res, function(user){
		db.logins.remove({
			token: req.json.token
		}, function(){
			res.success();
		});
	});
});

// Invalidate ALL tokens for the user given
app.post('/api/logoutAll', function(req, res){
	authUser(req, res, function(user){
		db.logins.remove({
			id: user.id
		}, function(){
			res.success();
		});
	});
});


  //////////////////////////////////
 // Application-only API methods //
//////////////////////////////////


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

	res.success({apiKey: key});
});

// Return {success: true} when a valid API Key is supplied
app.post('/api/checkAuth', function(req, res){
	checkAuth(req, res, function(){
		res.success();
	});
});

app.post('/api/getUsers', function(req, res){
	checkAuth(req, res, function(){
		if(!isNaN(req.json.lat + req.json.lng)){
			if(!isNaN(req.json.radius)){
				db.users.find({
					location: {
						$geoWithin: {
							$center:[
								[req.json.lng, req.json.lat], req.json.radius
							]
						}
					}
				}).toArray(function(err, users){
					if(err)
						return res.error(error);

					var tempUsers = [];
					for(var i = 0; i < users.length; i++)
						tempUsers.push(sanitizeUser(users[i]));

					res.success({users: tempUsers});
				});
			}else if(!isNaN(req.json.num)){
				db.users.find({
					location: {
						$near: [req.json.lng, req.json.lat]
					}
				}).limit(req.json.num).toArray(function(err, users){
					if(err)
						return res.error(error);

					var tempUsers = [];
					for(var i = 0; i < users.length; i++)
						tempUsers.push(sanitizeUser(users[i]));

					res.success({users: tempUsers});
				});
			}else
				res.error("No valid constraints supplied");
		}else
			res.error("No location supplied (or arguments were not numbers)");
	});
});

logLine(["INFO", "Started."]);
