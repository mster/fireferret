'use strict'

const MongoClient = require('./mongo')
const RedisClient = require('./redis')
const { toFlatmap, fromFlatmap } = require('./utils/flatmapper')
const { FFError } = require('./utils/error')
const SYMBOLS = require('./utils/symbols')

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

  async fetch (query, options) {
    if (!options) options = {}

    if (options.constructor.name !== 'Object') {
      throw new FFError(
        'InvalidOptions',
        'options must be an object or null',
        'client::fetch',
        options
      )
    }

    const sourceKey = keyify(
      this.mongo.dbName,
      this.mongo.collectionName,
      query,
      options
    )

    const idMap = (await this.redis.lrange(sourceKey)).reverse()

    const verdict = _verdict(idMap)

    debug(verdict.description, sourceKey)

    switch (verdict) {
      case SYMBOLS.cacheMiss:
        return cacheMiss.bind(this)(sourceKey)
      case SYMBOLS.cacheHit:
        return cacheHit.bind(this)(idMap)
      case SYMBOLS.emptyQuery:
        return []
    }

    async function cacheMiss (key) {
      const ids = []
      const hashes = []

      const docs = await this.mongo.findDocs(query)

      for (const doc of docs) {
        ids.push(doc._id)

        const flat = toFlatmap(doc)

        hashes.push({ hname: doc._id, args: flat })
      }

      if (ids.length === 0) {
        this.redis.lpush(key, [SYMBOLS.emptyQuery.description])
        return []
      }

      this.redis.lpush(key, ids)
      this.redis.multihset(hashes)

      return docs
    }

    async function cacheHit (idMap) {
      let { page, size } = options.pagination ? options.pagination : {}

      if (page && size) {
        debug('using pagination')

        if (isNaN(page) || isNaN(size)) {
          throw new FFError(
            'InvalidOptions',
            'Pagination requires page and size to be numbers',
            'client::fetch',
            options.pagination
          )
        }

        page = Number(page)
        size = Number(size)

        const start = (page - 1) * size
        const pageIdMap = idMap.slice(start, start + size)

        if (pageIdMap.length === 0) {
          return []
        }

        const docs = await this.redis.multihgetall(pageIdMap)
        return docs.map(e => fromFlatmap(e))
      }

      const docs = await this.redis.multihgetall(idMap)
      return docs.map(e => fromFlatmap(e))
    }
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

function keyify (db, collection, query, queryOptions) {
  try {
    const stringQuery = JSON.stringify(
      query,
      (key, value) => {
        if (value.constructor.name === 'RegExp') return value.toString()
        return value
      },
      0
    )
    const qKey = Buffer.from(stringQuery).toString('base64')

    const stringQueryOptions = JSON.stringify(queryOptions)
    const qOpKey = Buffer.from(stringQueryOptions).toString('base64')

    return `ff:${db}::${collection}:${qKey}::${qOpKey}`
  } catch (err) {
    throw new FFError('InternalError', 'Keyify failed', 'client::keyify', err)
  }
}

function _verdict (idMap) {
  return !idMap || idMap.length === 0
    ? SYMBOLS.cacheMiss
    : idMap && idMap[0] === SYMBOLS.emptyQuery.description
      ? SYMBOLS.emptyQuery
      : SYMBOLS.cacheHit
}

module.exports = FireFerret
