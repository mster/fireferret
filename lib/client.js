'use strict'

const MongoClient = require('./mongo')
const Cache = require('./cache')
const { generateOptions } = require('./options')
const { fetch, fetchById, fetchOne } = require('./fetch')

const debug = require('util').debuglog('fireferret::main')

/**
 * Creates a new FireFerret instance
 * @constructor
 * @param {object} options - FireFerret configuration options
 * @param {boolean} [options.wideMatch=false] Use Wide-Match strategy by default.
 * @param {object} options.mongo - MongoDB configuration.
 * @param {string} options.mongo.uri - The database URI
 * @param {string} options.mongo.dbName - The databse to query.
 * @param {string} [options.mongo.collectionName=''] - The default collection.
 * @param {object} options.redis - Redis Cache configuration.
 * @returns {FireFerret}
 */
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

  /**
   * Establish a connection to both data stores.
   * @returns {string} The connection status.
   */
  async connect () {
    await this.cache.connect()
    await this.mongo.connect()

    return 'ok'
  }

  /**
   * Gracefully close all active connections.
   * @returns {string} The close status.
   */
  async close () {
    await this.cache.close()
    await this.mongo.close()

    return 'ok'
  }
}

FireFerret.prototype.fetch = fetch

FireFerret.prototype.fetchById = fetchById

FireFerret.prototype.fetchOne = fetchOne

module.exports = FireFerret
