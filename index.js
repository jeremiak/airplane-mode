#!/usr/local/bin/node
var colors = require('colors');
var express = require('express');
var portfinder = require('portfinder');
var request = require('request');

portfinder.basePort = 3000;

var app = express(), server;
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
    console.log('cached url: \t'.green, desiredUrl);
    var body = cache[desiredUrl]['body'];
    var headers = cache[desiredUrl]['headers']
    res.set(headers);
    res.send(body);
  }
  else {
    console.log('not cached url: '.red, desiredUrl);

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

function welcomeText(host, port){
  var package = require('./package.json');
  var url = 'http://' + host + ':' + port;

  console.log('airplane-mode http cache v' + package['version']);
  console.log('listening at ' + url.blue);
  console.log('open url like ' + (url + '/developer.trade.gov/api.json').blue + ' to cache');
  console.log('use ' + (url + '/cache').blue + ' to view currently cached data');
  console.log('full readme can be found at https://github.com/jeremiak/airplane-mode');
  console.log('\n\n');
}

portfinder.getPort(function (err, port) {
  server = app.listen(port, function() {
    var host = server.address().address;
    welcomeText(host, port);
  });
});
