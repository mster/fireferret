'use strict'

const MongoClient = require('./mongo')
const Cache = require('./cache')
const { generateOptions } = require('./options')
const { fetch, fetchById, fetchOne } = require('./fetch')

const debug = require('util').debuglog('fireferret::main')

class FireFerret {
  constructor (options) {
    const mongoOpts = generateOptions(options.mongo, 'mongo')
    const cacheOpts = generateOptions(options, 'cache')

    const mongoClientOpts = generateOptions(options.mongo, 'mongoClient')
    const redisClientOpts = generateOptions(options.redis, 'redisClient')

    this.mongo = new MongoClient(mongoOpts.uri, mongoOpts, mongoClientOpts)
    this.cache = new Cache(cacheOpts, redisClientOpts)

    debug('FireFerret client created')
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
