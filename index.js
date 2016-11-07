#!/usr/bin/env node

var portfinder = require('portfinder')

var app = require('./app/server.js')
var db = require('./util/db.js')
var getConfig = require('./util/getConfig.js')
var package = require('./package.json')

var config = getConfig(process.argv.slice(2))
app.set('FORCE_CORS', config.forceCors)

function helpText() {
  var demo = 'http://www.theschmearcampaign.com'
  var text = [
    `airplane-mode version ${package['version']}`,
    `${package.description}`,
    `\n`,
    `cache a URL by appending it to the airplane-mode server url.`,
    `for example, http://0.0.0.0:${config.port}/${demo} would cache ${demo}`,
    `\n`,
    `you can also set some options:`,
    `  --clear-cache will clear the cache when the server starts`,
    `  --cors will force every response to allow CORS requests`,
    `  --port ${config.port} will use ${config.port} if it is available`
  ].join('\n')

  console.log(`${text}\n`)
}

function runningText(host, port){
  var text = [
    `airplane-mode version ${package['version']}`,
    `listening at http://${host}:${port}`,
    '  run with --help for more instructions'
  ].join('\n')

  console.log(`${text}\n`)
}

function start() {
  portfinder.basePort = config.port
  portfinder.getPort(function (err, port) {
    server = app.listen(port, '0.0.0.0', function() {
      var host = server.address().address;
      runningText(host, port);
    })
  })
}

if (config.showHelp) return helpText()
if (config.clearCache) return db.clear(() => start())

start()
