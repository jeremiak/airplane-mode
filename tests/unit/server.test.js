var test = require('tape')

var server = require('../../app/server.js')

test('removeProxyUrl()', function (t) {
  var host = 'http://localhost:3000'
  var url = 'http://www.example.com'
  t.plan(2)

  t.equal(server.removeProxyUrl(`${host}/${url}`), url)
  t.equal(server.removeProxyUrl(`${url}`), url)
})
