var path = require('path')

var express = require('express')
var request = require('request')
var db = require('../util/db.js')

var app = express(), server

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

function addCorsHeader(res) {
  res.set({ 'Access-Control-Allow-Origin': '*'})
  return res
}

function fetchUrlAndCache(url, cb) {
  console.log(`making request for ${url}`)
  request.get(url, function (err, res, body) {
    if (err) return cb(err)
    var data = {
      headers: res.headers,
      body
    }

    db.putJSON(url, data, (err) => {
      if (err) return cb(err)

      cb(null, data)
    })
  })
}

function makeUrl(req) {
  var headers = req.headers
  var isAsset = (headers.referer) ? true : false
  var path = `${req.originalUrl.slice(1)}`

  if (!isAsset) return path

  var referrer = removeProxyUrl(headers.referer)
  return `${referrer}/${path}`
}

function removeProxyUrl(url) {
  return url.replace(/^http:\/\/\w+:\d+\//, '')
}

function respondWithCachedUrl(res, data, cors) {
  if (cors) addCorsHeader(res)
  res.set(data.headers)
  return res.send(data.body)
}

app.get('/', function(req, res) {
  res.redirect('/cache')
})

app.get('/favicon.ico', function(req, res) {
  res.sendStatus(404)
})

app.get('/cache', function (req, res) {
  db.dumpKeys(function (keys) {
    res.render('cache', { keys })
  })
})

app.get('/cache/keys.json', function(req, res) {
  db.dumpKeys(function (data) {
    res.send(data)
  })
})

app.delete('/cache', function (req, res) {
  console.log('DELETE all')
  db.clear((err) => {
    if (err) return res.send(err)
    return res.sendStatus(200)
  })
})

app.delete('/*', function (req, res) {
  var url = makeUrl(req)
  console.log(`DELETE ${url}`)
  db.del(url, (err) => {
    if (err) return res.send(err)
    return res.sendStatus(200)
  })
})

app.get('/*', function(req, res) {
  var cors = app.get('FORCE_CORS')
  var url = makeUrl(req)
  console.log(`GET ${url}`)
  console.log(`req.originalUrl ${req.originalUrl}`)
  db.getJSON(url, function (err, data) {
    if (!err) {
      console.log('\turl is cached and it was successfully retrieved')
      return respondWithCachedUrl(res, data, cors)
    } else if (err && err.type === 'NotFoundError') {
      console.log('\turl is NOT cached and it being retrieved')
      fetchUrlAndCache(url, (err, data) => {
        if (err) return res.send(err)
        if (cors) addCorsHeader(res)
        console.log('\turl is has been cached')
        res.set(data.headers)
        return res.send(data.body)
      })
    } else {
      return res.send(err)
    }
  })
})

module.exports = app

if (process.env.NODE_TEST) {
  module.exports = Object.assign({}, module.exports, {
    addCorsHeader,
    fetchUrlAndCache,
    makeUrl,
    removeProxyUrl,
    respondWithCachedUrl
  })
}
