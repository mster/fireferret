'use strict'

const MongoClient = require('./clients/mongo')
const RedisClient = require('./clients/redis')
const { FIREFERRET_DEFAULT_OPTS } = require('./utils/options')
const { fetch, fetchById } = require('./fns/fetch')

const debug = require('util').debuglog('fireferret::main')

class FireFerret {
  constructor (options) {
    this.redis = new RedisClient(options.REDIS_OPTS)
    this.mongo = new MongoClient(options.MONGO_OPTS.uri, options.MONGO_OPTS)

    /* Delete sensitive info before binding options */
    delete options.REDIS_OPTS
    delete options.MONGO_OPTS

    this.options = { ...FIREFERRET_DEFAULT_OPTS, ...options }

    debug('FireFerret client created', this.options)
  }

  async connect () {
    await this.redis.connect()
    await this.mongo.connect()

    return 'ok'
  }

  async close () {
    await this.redis.close()
    await this.mongo.close()

    return 'ok'
  }
}

FireFerret.prototype.fetchById = fetchById

FireFerret.prototype.fetch = fetch

module.exports = FireFerret
