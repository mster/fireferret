'use strict'

const MongoClient = require('./mongo')
const RedisClient = require('./redis')
const { toFlatmap } = require('./utils/flatmapper')

const debug = require('util').debuglog('fireferret::main')

class FireFerret {
  constructor (options) {
    this.mongo = new MongoClient(options.MONGO_OPTS.uri, options.MONGO_OPTS)
    this.redis = new RedisClient({ ...options.REDIS_OPTS })
  }

  async connect () {
    await this.redis.connect()
    await this.mongo.connect()
  }

  async close () {
    await this.redis.close()
    await this.mongo.close()
  }

  async fetch (query) {
    const sourceKey = keyify(
      this.mongo.dbName,
      this.mongo.collectionName,
      query
    )

    const idMap = await this.redis.lrange(sourceKey)

    /*
      Cache Miss -- Fetch from Mongo and Cache
     */
    if (!idMap || idMap.length === 0) {
      debug('cache miss')

      const ids = []
      const hashes = []

      try {
        const docs = await this.mongo.findDocs(query)

        for (const doc of docs) {
          if (typeof doc._id === 'object') {
            doc._id = doc._id.toString()
          }

          ids.push(doc._id)

          const flat = toFlatmap(doc)

          hashes.push({ hname: doc._id, args: flat })
        }

        if (ids.length === 0) {
          return 'empty query'
        }

        await this.redis.multihset(hashes)
        await this.redis.lpush(sourceKey, ids)

        return 'ok'
      } catch (err) {
        err.constructorName = 'fireferret'
        throw err
      }
    }

    /*
      Query Matched - loading documents from Redis
     */
    debug('in cache')
    let docs

    try {
      const flatDocs = await this.redis.multihgetall(idMap)

      docs = flatDocs
    } catch (err) {
      err.constructorName = 'fireferret'
      throw err
    }

    return docs
  }

  fetchById (id, options) {}
}

function keyify (db, collection, query) {
  try {
    const stringQuery = JSON.stringify(query)
    const qKey = Buffer.from(stringQuery).toString('hex')
    return `${db}::${collection}::${qKey}`
  } catch (err) {
    err.constructorName = 'fireferret'
    throw err
  }
}

module.exports = FireFerret
