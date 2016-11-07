var sinon = require('sinon')
var test = require('tape')

var helpers = require('../helpers.js')
var server = require('../../app/server.js')

test('addCorsHeader() should add CORS header', function (t) {
  var res = helpers.createResponse()
  var spy = sinon.spy(res, 'set')
  server.addCorsHeader(res)

  t.plan(1)
  t.deepEqual({ 'Access-Control-Allow-Origin': '*' }, spy.args[0][0])
})

test('removeProxyUrl()', function (t) {
  var host = 'http://localhost:3000'
  var url = 'http://www.example.com'

  t.plan(2)
  t.equal(server.removeProxyUrl(`${host}/${url}`), url)
  t.equal(server.removeProxyUrl(`${url}`), url)
})

test('respondWithCachedUrl without cors should set headers and body', function (t) {
  var data = {
    headers: {
      'test-header': 'foo'
    },
    body: 'fake data here'
  }
  var res = helpers.createResponse()
  var sendSpy = sinon.spy(res, 'send')
  var setSpy = sinon.spy(res, 'set')
  server.respondWithCachedUrl(res, data)

  t.plan(2)
  t.deepEqual(data.body, sendSpy.args[0][0])
  t.deepEqual(data.headers, setSpy.args[0][0])
})

test('respondWithCachedUrl with cors should set headers and body and cors', function (t) {
  var data = {
    headers: {
      'test-header': 'foo'
    },
    body: 'fake data here'
  }
  var res = helpers.createResponse()
  var spy = sinon.spy(res, 'set')
  server.respondWithCachedUrl(res, data, true)

  t.plan(1)
  t.deepEqual(2, spy.callCount)
})
