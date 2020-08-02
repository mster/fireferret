'use strict'

module.exports.filterOpts = function (options, inclusionSet) {
  const filteredOpts = {}
  for (const key of Object.keys(options)) {
    if (inclusionSet[key] !== undefined) filteredOpts[key] = options[key]
  }
  return filteredOpts
}

module.exports.FIREFERRET_DEFAULT_OPTS = {
  wideMatch: false
}

module.exports.MONGO_VANILLA_OPTS = []

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
