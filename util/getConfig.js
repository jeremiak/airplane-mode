function configFromArgs(args = []) {
  var corsFlag = args.indexOf('--cors') > -1
  var portFlag = args.indexOf('--port') > -1
  var helpFlag = args.indexOf('--help') > -1

  return {
    forceCors: (corsFlag) ? true : false,
    port: (portFlag) ? parseInt(args[args.indexOf('--port')+1]) : 3000,
    showHelp: (helpFlag) ? true : false
  }
}

module.exports = configFromArgs
