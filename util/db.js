var path = require('path')
var levelup = require('levelup')

var DB_PATH = path.join(__dirname, '../data/url-cache.db')
var db = levelup(DB_PATH, {
  valueEncoding: 'json'
})

function DB() {

}

DB.prototype = db

DB.prototype.clear = function clear(cb) {
  this.dumpKeys((keys) => {
    if (!keys) return cb()
    var ops = keys.map((key) => {
      return {type: 'del', key }
    })

    db.batch(ops, (err) => {
      if (err) return cb(err)
      cb()
    })
  })
}

DB.prototype.dump = function dump(cb) {
  var dumped = {}
  db.createReadStream({ keys: true, values: true })
    .on('data', function (data) {
      dumped[data.key] = data.value
    })
    .on('close', function () {
      if (cb) return cb(dumped)
      console.log('database dump', dumped)
    })
}

DB.prototype.dumpKeys = function dump(cb) {
  var keys = []
  db.createReadStream({ keys: true, values: false })
    .on('data', function (data) {
      keys.push(data)
    })
    .on('close', function () {
      if (cb) return cb(keys)
      console.log('keys dump', keys)
    })
}

DB.prototype.getJSON = function getJSON(key, cb) {
  db.get(key, (err, data) => {
    if (err) return cb(err)

    cb(null, JSON.parse(data))
  })
}

DB.prototype.putJSON = function putJSON(key, value, cb) {
  db.put(key, JSON.stringify(value), (err, data) => {
    if (err) return cb(err)

    cb(null, value)
  })
}

module.exports = new DB()
