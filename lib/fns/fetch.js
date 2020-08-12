'use strict'

const { keyify, getQueryVerdict } = require('../utils/query')
const { EMPTY_QUERY, CACHE_MISS, CACHE_HIT } = require('../utils/symbols')
const {
  validatePaginationOpts,
  filterAvailableWideMatch
} = require('../utils/page')
const { coerce } = require('../utils/document')
const { toFlatmap, fromFlatmap } = require('../utils/flatmapper')
const { FFError } = require('../utils/error')

const debug = require('util').debuglog('fireferret::fetch')

module.exports.fetch = async function (query, options) {
  if (!options) options = {}

  if (options.constructor.name !== 'Object') {
    throw new FFError(
      'InvalidOptions',
      'options must be of type Object or null',
      'fetch::fetch',
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

  const initalVerdict = getQueryVerdict(idMap)
  debug(initalVerdict.description, sourceKey)

  switch (initalVerdict) {
    case CACHE_HIT:
      return cacheHit.bind(this)(idMap)
    case EMPTY_QUERY:
      return []
    case CACHE_MISS:
      /* using wideMatch options */
      if (this.options.wideMatch) {
        const wideMatch = await getWideMatch.bind(this)(
          this.mongo.dbName,
          this.mongo.collectionName,
          query,
          options
        )

        const wideMatchVerdict = getQueryVerdict(wideMatch)
        debug(wideMatchVerdict.description, 'wide-match attempt')

        switch (getQueryVerdict(wideMatch)) {
          case CACHE_HIT:
            this.redis.lpush(sourceKey, wideMatch.reverse())
            return cacheHit.bind(this)(wideMatch)
          case EMPTY_QUERY:
            return []
          case CACHE_MISS:
            return cacheMiss.bind(this)(query, sourceKey, options)
        }
      }

      /* not wide-match */
      return cacheMiss.bind(this)(query, sourceKey, options)
  }
}

module.exports.fetchById = async function (id) {
  if (!(id && (id.constructor.name !== 'ObjectID' || id.constructor.name !== 'String'))) {
    throw new FFError(
      'InvalidOptions',
      'options must be of type Object or null',
      'fetch::fetchById',
      { id }
    )
  }

  const cached = await this.redis.hgetall(id)

  if (!cached || cached.length === 0) {
    const doc = await this.mongo.findById(id)

    this.redis.hset(id, toFlatmap(doc))

    return doc
  }

  return coerce.bind(this.mongo)(cached)
}

async function cacheHit (ids, options = {}) {
  const pageOpts = validatePaginationOpts(options)

  if (pageOpts) {
    const { start, end } = pageOpts

    const pageIdMap = ids.slice(start, end)

    if (pageIdMap.length === 0) {
      debug('pageIdMap length 0', start, end, ids.length)
      return []
    }

    ids = pageIdMap
  }

  const docs = await this.redis.multihgetall(ids)
  return docs.map(e => fromFlatmap.bind(this.mongo)(e))
}

async function cacheMiss (query, sourceKey, options = {}) {
  const ids = []
  const hashes = []

  const pageOptions = validatePaginationOpts(options)
  const mongoQueryOptions = {}

  /* with pagination */
  if (pageOptions) {
    mongoQueryOptions.skip = pageOptions.start
    mongoQueryOptions.limit = pageOptions.size

    debug('using pagination', mongoQueryOptions)
  }

  const docs = await this.mongo.findDocs(query, mongoQueryOptions)

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]

    ids.push(doc._id)
    hashes.push({ hname: doc._id.toString(), args: toFlatmap(doc) })
  }

  if (ids.length === 0) {
    this.redis.lpush(sourceKey, [EMPTY_QUERY.description])
  } else {
    this.redis.lpush(sourceKey, ids)
    this.redis.multihset(hashes)
  }

  return docs
}

async function getWideMatch (db, collection, query, queryOptions) {
  const baseKey = keyify(db, collection, query)
  const scanPattern = `${baseKey}*`

  const [, cachedQueries] = await this.redis.scan(0, scanPattern)

  if (cachedQueries && cachedQueries.length > 0) {
    const pageOptions = validatePaginationOpts(queryOptions)
    const { targetQuery, rangeOptions } = filterAvailableWideMatch(
      cachedQueries,
      pageOptions
    )

    if (targetQuery && rangeOptions) {
      return this.redis.lrange(
        targetQuery,
        rangeOptions.start,
        rangeOptions.end - 1
      )
    }
  }

  return 0
}
