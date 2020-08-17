'use strict'

const MongoClient = require('./mongo')
const Cache = require('./cache')
const { FIREFERRET_DEFAULT_OPTS } = require('./options')
const { fetch, fetchById, fetchOne } = require('./fetch')

const debug = require('util').debuglog('fireferret::main')

class FireFerret {
  constructor (options) {
    this.mongo = new MongoClient(options.MONGO_OPTS.uri, options.MONGO_OPTS)
    this.cache = new Cache(options, options.REDIS_OPTS)

    /* Delete sensitive info before binding options */
    delete options.REDIS_OPTS
    delete options.MONGO_OPTS

    this.options = { ...FIREFERRET_DEFAULT_OPTS, ...options }

    debug('FireFerret client created', this.options)
  }

  async connect () {
    await this.cache.connect()
    await this.mongo.connect()

    return 'ok'
  }

  async close () {
    await this.cache.close()
    await this.mongo.close()

    return 'ok'
  }
}

FireFerret.prototype.fetchById = fetchById

FireFerret.prototype.fetch = fetch

FireFerret.prototype.fetchOne = fetchOne

module.exports = FireFerret
