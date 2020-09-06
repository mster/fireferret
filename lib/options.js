'use strict'

/**
 * @namespace Options
 */

/**
 * @memberof Options
 *
 * @typedef {Object} QueryOptions
 *
 * @property {Boolean} [stream=false] - Format the query response as a stream.
 * @property {Object} [pagination=null] Pagination options.
 * @property {Number|String} pagination.page=null - The page number, starting at 1.
 * @property {Number|String} pagination.size=null - The page size, greater than 0.
 *
 * @example
 * { stream: true, pagination: { page: 2, size: 50 } }
 */

/**
 * @memberof Options
 *
 * @typedef {Object} FireFerretOptions
 *
 * @property {Options.Mongo} mongo
 * @property {Options.Redis} redis
 * @property {boolean} wideMatch=false - Use the Wide-Match strategy when checking the cache for queries.
 */

/**
 * @memberof Options
 *
 * @typedef {Object} Mongo - Dictates MongoDB driver behavior. Additional Driver documentation can be found {@link http://mongodb.github.io/node-mongodb-native/|here}.
 *
 * @property {String} uri - The MongoDB URI.
 * @property {String} dbName - The name of the MongoDB database to connect to.
 * @property {String} collectionName=null - The default database collection.
 * @property {Boolean} ndJSON=false - Stream documents using the ndJSON spec.
 * @property {String} encoding="utf-8" - Encoding to use when streaming.
 */

/**
 * @memberof Options
 *
 * @typedef {Object} Redis - Dictates Redis client behavior. Additional Client documentation can be found {@link https://www.npmjs.com/package/redis#options-object-properties|here}.
 *
 * @property {Boolean} ndJSON=false - Stream documents using the ndJSON spec.
 * @property {Number} connectionTimeout=5000 - Timeout in milliseconds when connecting.
 * @property {Number} count=1000 - Default Redis SCAN work amount.
 * @property {Number} batchSize=1000 - Default batch size when using LPUSH.
 */

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
    count: 1000,
    connectionTimeout: 5000,
    batchSize: 1000,
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
 * @memberof Options
 *
 * Generate client specific options by filtering out invalid fields.
 *
 * @param {Object} source - The source options to generate from.
 * @param {String} name - Name of the client/driver the options are for.
 * @param {boolean} [setDefaults=true] - If a source value is not present, use the default value.
 *
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
