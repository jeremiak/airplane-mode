function configFromArgs(args = []) {
  var clearFlag = (args.indexOf('--clear-cache') > -1)
  var corsFlag = (args.indexOf('--cors') > -1)
  var helpFlag = (args.indexOf('--help') > -1)
  var portFlag = (args.indexOf('--port') > -1)

  return {
    clearCache: (clearFlag) ? true: false,
    forceCors: (corsFlag) ? true : false,
    port: (portFlag) ? parseInt(args[args.indexOf('--port')+1]) : 3000,
    showHelp: (helpFlag) ? true : false
  }
}

module.exports = configFromArgs
