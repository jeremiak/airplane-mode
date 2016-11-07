var test = require('tape')

var getConfig = require('../../util/getConfig')

test('config() with no args should return defaults', function (t) {
  var config = getConfig()
  t.plan(4)
  t.equal(config.clearCache, false)
  t.equal(config.forceCors, false)
  t.equal(config.port, 3000)
  t.equal(config.showHelp, false)
})

test('config() with --clear-cache should set clearCache to true', function (t) {
  var args = ['--clear-cache']
  var config = getConfig(args)
  t.plan(1)
  t.equal(config.clearCache, true)
})

test('config() with --cors should set forceCors to true', function (t) {
  var args = ['--cors']
  var config = getConfig(args)
  t.plan(1)
  t.equal(config.forceCors, true)
})

test('config() with --port 5000 should set port to 5000', function (t) {
  var args = ['--port', '5000']
  var config = getConfig(args)
  t.plan(1)
  t.equal(config.port, 5000)
})

test('config() with --help should set showHelp to true', function (t) {
  var args = ['--help']
  var config = getConfig(args)
  t.plan(1)
  t.equal(config.showHelp, true)
})
