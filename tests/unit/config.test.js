var test = require('tape')

var getConfig = require('../../util/getConfig')

test('config() with no args should return defaults', function (t) {
  var config = getConfig()
  t.plan(3)
  t.equal(config.forceCors, false)
  t.equal(config.port, 3000)
  t.equal(config.showHelp, false)
})

test('config() with --cors should set forceCors to true', function (t) {
  var args = ['--cors']
  var config = getConfig(args)
  t.plan(3)
  t.equal(config.forceCors, true)
  t.equal(config.port, 3000)
  t.equal(config.showHelp, false)
})

test('config() with --port 5000 should set port to 5000', function (t) {
  var args = ['--port', '5000']
  var config = getConfig(args)
  t.plan(3)
  t.equal(config.forceCors, false)
  t.equal(config.port, 5000)
  t.equal(config.showHelp, false)
})

test('config() with --help should set showHelp to true', function (t) {
  var args = ['--help']
  var config = getConfig(args)
  t.plan(3)
  t.equal(config.forceCors, false)
  t.equal(config.port, 3000)
  t.equal(config.showHelp, true)
})
