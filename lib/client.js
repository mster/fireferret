'use strict'

const MongoClient = require('./mongo')
const RedisClient = require('./redis')
const { toFlatmap } = require('./utils/flatmapper')

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

        this.redis.lpush(sourceKey, ids)

        if (ids.length === 0) {
          debug('empty query')

          return []
        }

        this.redis.multihset(hashes)

        return docs
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

  async fetchById (id) {
    try {
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
    } catch (err) {
      err.constructorName = 'fireferret'
      throw err
    }
  }
}

function keyify (db, collection, query) {
  debug('keyify')

  try {
    const stringQuery = JSON.stringify(query)
    const qKey = Buffer.from(stringQuery).toString('hex')

    return `ff:${db}::${collection}::${qKey}`
  } catch (err) {
    err.constructorName = 'fireferret'
    throw err
  }
}

module.exports = FireFerret
