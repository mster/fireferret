'use strict'

const MongoClient = require('./mongo')
const RedisClient = require('./redis')

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
    const redisKey = keyify(this.mongo.dbName, this.mongo.collectionName, query)

    let data

    try {
      const cachedData = await this.redis.hgetall(redisKey)

      if (!cachedData) {
        debug('cache miss')

        const docs = await this.mongo.findDocs(query)

        try {
          for (const doc of docs) {
            await this.redis.hset(redisKey, `${doc._id}`, JSON.stringify(doc))
          }
        } catch (err) {
          err.constructorName = 'fireferret'
          throw err
        }

        data = docs
      } else {
        data = Object.values(cachedData).map(e => JSON.parse(e))

        debug('in cache')
      }
    } catch (err) {
      err.constructorName = 'fireferret'
      throw err
    }

    return data
  }

  fetchById (id, options) {}
}

function keyify (db, collection, query) {
  const qKey = Buffer.from(JSON.stringify(query)).toString('hex')

  return `${db}::${collection}::${qKey}`
}

module.exports = FireFerret
