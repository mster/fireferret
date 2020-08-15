'use strict'

module.exports.filterOpts = function (options, inclusionSet) {
  const filteredOpts = {}
  const keys = Object.keys(options)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (inclusionSet[key] !== undefined) filteredOpts[key] = options[key]
  }
  return filteredOpts
}

/*
    FireFerret defaults
*/
module.exports.FIREFERRET_DEFAULT_OPTS = {
  wideMatch: false
}

/*
    FireFerret MongoDB Client defaults
*/
module.exports.FF_MONGO_DEFAULTS = {
  encoding: 'utf-8',
  streamDocumentSkip: 1e4,
  db: '',
  collection: ''
}

/*
    FireFerret Redis Client defaults
*/
module.exports.FF_REDIS_DEFAULTS = {
  count: 1e5,
  connectionTimeout: 5000
}

/*
    Node Mongodb defaults
*/
module.exports.MONGO_VANILLA_OPTS = {}

/*
    Node-Redis defaults
*/
module.exports.REDIS_VANILLA_OPTS = {
  host: '127.0.0.1',
  port: 6379,
  path: null,
  url: null,
  string_numbers: null,
  return_buffers: false,
  detect_buffers: false,
  socket_keepalive: true,
  socket_initial_delay: 0,
  no_ready_check: false,
  enable_offline_queue: true,
  retry_unfilfilled_commands: false,
  password: null,
  auth_pass: null,
  db: null,
  family: 'IPv4',
  disable_resubscribing: null,
  rename_commands: null,
  tls: null,
  prefix: null,
  retry_strategy: function noop () {}
}
