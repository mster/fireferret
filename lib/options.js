'use strict'

const DEFAULTS = {
  cache: {
    wideMatch: true
  },
  mongo: {
    ndJSON: false,
    encoding: 'utf-8',
    dbName: '',
    collectionName: '',
    uri: ''
  },
  mongoClient: {
    useUnifiedTopology: true
  },
  redisClient: {
    ndJSON: false,
    count: 1e5,
    connectionTimeout: 5000,
    streamDocumentSkip: 1e4,
    batchSize: 1e4,
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
    retry_strategy: null
  }
}

/**
 * Generate client specific options by filtering out invalid fields.
 * @param {Object} source - The source options to generate from.
 * @param {String} name - Name of the client these options are for.
 * @param {boolean} [setDefaults=true] - If a source value is not present, use the default value.
 * @returns {Object} Client specific options.
 */
function generateOptions (source, name, setDefaults = true) {
  if (!source) return {}

  const options = {}

  const keys = Object.keys(DEFAULTS[name])
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (source[key]) options[key] = source[key]
    else if (setDefaults && DEFAULTS[name][key] !== null) {
      options[key] = DEFAULTS[name][key]
    }
  }

  return options
}

module.exports = { generateOptions }
