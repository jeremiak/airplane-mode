#!/usr/local/bin/node

var express = require('express');
var request = require('request');

var app = express();

var db = {};

app.get('/dump', function(req, res) {
  res.send(db);
});

app.get('/*', function(req, res){
  var desiredUrl = req.path.slice(1);

  if (db.hasOwnProperty(desiredUrl)) {
    console.log('cached url', desiredUrl);
    var body = db[desiredUrl]['body'];
    res.send(body);
  }
  else {
    console.log('not cached url', desiredUrl);
    var options = {
      'url': 'http://' + desiredUrl,
      qs: req.query
    }
    request.get(options, function (err, response, body) {
      responseData = {
        'headers': {},
        'body': body
      }
      db[desiredUrl] = responseData;
      res.send(body);
    });
  }
});

var server = app.listen(3000, function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Listening at %s:%s', host, port);
})
