'use strict'

const { keyify, getQueryVerdict } = require('../utils/query')
const { EMPTY_QUERY, CACHE_MISS, CACHE_HIT } = require('../utils/symbols')
const { validatePaginationOpts } = require('../utils/page')
const { toFlatmap, fromFlatmap } = require('../utils/flatmapper')
const { FFError } = require('../utils/error')

const debug = require('util').debuglog('fireferret::fetch')

module.exports.fetch = async function (query, options) {
  if (!options) options = {}

  if (options.constructor.name !== 'Object') {
    throw new FFError(
      'InvalidOptions',
      'options must be an object or null',
      'client::fetch',
      { options }
    )
  }

  const sourceKey = keyify(
    this.mongo.dbName,
    this.mongo.collectionName,
    query,
    options
  )

  const idMap = await this.redis.lrange(sourceKey)

  const verdict = getQueryVerdict(idMap)

  debug(verdict.description, sourceKey)

  switch (verdict) {
    case CACHE_MISS:
      if (this.options.wideMatch) {
        const wideMatch = await getWideMatch.bind(this)(
          this.mongo.dbName,
          this.mongo.collectionName,
          query,
          options
        )

        debug(getQueryVerdict(wideMatch).description, wideMatch)

        if (!wideMatch) {
          return cacheMiss.bind(this)(sourceKey)
        }

        if (wideMatch[0] === EMPTY_QUERY.description) {
          return []
        }

        this.redis.lpush(sourceKey, wideMatch.reverse())
        return cacheHit.bind(this)(wideMatch)
      }

      return cacheMiss.bind(this)(sourceKey)
    case CACHE_HIT:
      return cacheHit.bind(this)(idMap)
    case EMPTY_QUERY:
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
      this.redis.lpush(key, [EMPTY_QUERY.description])
      return []
    }

    this.redis.lpush(key, ids)
    this.redis.multihset(hashes)

    return docs
  }

  async function cacheHit (ids, options = {}) {
    const pageOpts = validatePaginationOpts(options)

    if (pageOpts) {
      const { start, end } = pageOpts

      const pageIdMap = ids.slice(start, end)

      if (pageIdMap.length === 0) {
        return []
      }

      const docs = await this.redis.multihgetall(pageIdMap)
      return docs.map(e => fromFlatmap(e))
    }

    const docs = await this.redis.multihgetall(ids)
    return docs.map(e => fromFlatmap(e))
  }

  async function getWideMatch (db, collection, query, options) {
    const wideNet = [keyify(db, collection, query)]
    const existsMap = await this.redis.multiexists(wideNet)

    debug(existsMap, wideNet)

    for (let i = 0; i < existsMap.length; i++) {
      /*
          WIDE-MATCH-PAGINATION: (last index of net)
          We've cached this query before, but now we can paginate it
        */
      if (existsMap[i] === 1 && i === existsMap.length - 1) {
        const pageOptions = validatePaginationOpts(options)

        if (pageOptions) {
          debug('wide matched with non-paginated query')
          const { start, end } = pageOptions

          return this.redis.lrange(wideNet[wideNet.length - 1], start, end - 1)
        }
      }
    }

    return 0
  }
}

module.exports.fetchById = async function (id) {
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
