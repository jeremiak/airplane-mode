#!/usr/local/bin/node

var express = require('express');
var request = require('request');

var app = express();

var cache = {};

app.get('/favicon.ico', function(req, res) {
  res.sendStatus(404);
});

app.get('/cache', function(req, res) {
  res.send(cache);
});

app.get('/*', function(req, res){
  var desiredUrl = req.path.slice(1);

  if (cache.hasOwnProperty(desiredUrl)) {
    console.log('cached url: ', desiredUrl);
    var body = cache[desiredUrl]['body'];
    var headers = cache[desiredUrl]['headers']
    res.set(headers);
    res.send(body);
  }
  else {
    console.log('not cached url: ', desiredUrl);

    var options = {
      url: 'http://' + desiredUrl,
      qs: req.query
    };

    request.get(options, function (err, response, body) {
      if (!err) {
        var headers = response.headers;
        responseData = {
          headers: headers,
          body: body
        }
        cache[desiredUrl] = responseData;

        res.set(headers);
        res.send(body);
      }
      else {
        res.send(err);
      }
    });
  }
});

function welcome(host, port){
  var package = require('./package.json')

  console.log('makeshift http cache v' + package['version']);
  console.log('readme can be found at https://github.com/jeremiak/makeshift-http-cache');
  console.log('listening at %s:%s', host, port);
}

var server = app.listen(3000, function() {
  var host = server.address().address;
  var port = server.address().port;
  welcome(host, port);
})
