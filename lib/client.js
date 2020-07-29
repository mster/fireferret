'use strict'

const MongoClient = require('./mongo')
const RedisClient = require('./redis')
const { toFlatmap } = require('./utils/flatmapper')
const { FFError } = require('./utils/error')

const debug = require('util').debuglog('fireferret::main')

class FireFerret {
  constructor (options) {
    this.redis = new RedisClient({ ...options.REDIS_OPTS })
    this.mongo = new MongoClient(options.MONGO_OPTS.uri, options.MONGO_OPTS)

    debug('FireFerret client created')
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

  async fetch (query) {
    const cacheMiss = async key => {
      const ids = []
      const hashes = []

      const docs = await this.mongo.findDocs(query)

      for (const doc of docs) {
        if (typeof doc._id === 'object') {
          doc._id = doc._id.toString()
        }

        ids.push(doc._id)

        const flat = toFlatmap(doc)

        hashes.push({ hname: doc._id, args: flat })
      }

      this.redis.lpush(key, ids)

      if (ids.length === 0) {
        debug('empty query')

        return []
      }

      this.redis.multihset(hashes)

      return docs
    }

    const cacheHit = async idMap => {
      return await this.redis.multihgetall(idMap)
    }

    const sourceKey = keyify(
      this.mongo.dbName,
      this.mongo.collectionName,
      query
    )

    const idMap = await this.redis.lrange(sourceKey)

    /*
      Cache Miss -- Fetch from Mongo then cache
     */
    if (!idMap || idMap.length === 0) {
      debug('cache miss')

      return await cacheMiss(sourceKey)
    }

    /*
      Query Matched - loading documents from Redis
     */
    debug('in cache')

    return await cacheHit(idMap)
  }

  async fetchById (id) {
    const doc = await this.redis.hgetall(id)

    /*
      Cache Miss -- Fetch from Mongo then cache
     */
    if (!doc || doc.length === 0) {
      debug('cache miss')

      const doc = await this.mongo.findById(id)

      const flatDoc = toFlatmap(doc)

      this.redis.hset(id, flatDoc)

      return doc
    }

    /*
      Query Matched - loading documents from Redis
     */
    debug('in cache')

    return doc
  }
}

function keyify (db, collection, query) {
  debug('keyify')

  try {
    const stringQuery = JSON.stringify(query)
    const qKey = Buffer.from(stringQuery).toString('utf-8')

    return `ff:${db}::${collection}:${qKey}`
  } catch (err) {
    throw new FFError('InternalError', 'Keyify failed', err)
  }
}

module.exports = FireFerret
