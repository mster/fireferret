'use strict'

const pump = require('pump')
const { PassThrough } = require('stream')

const RedisClient = require('./redis')
const { makeBucket, hashFunction } = require('./bucket')
const {
  SYMBOLS: { NULL_DOC, EMPTY_QUERY },
  validatePaginationOpts,
  filterAvailableWideMatch
} = require('./utils')
const debug = require('util').debuglog('fireferret::cache')

/**
 * Creates a new Cache instance.
 * @constructor
 * @param {object} options - Cache options
 * @param {redisOptions} redisOptions - Redis client options.
 * @returns {Cache} - The FireFerret Cache controller.
 */
class Cache {
  constructor (options, redisOptions) {
    this.options = options
    this.redis = new RedisClient(redisOptions)
  }

  /**
   * Sets the queryList and caches documents into Redis.
   * @param {QueryKey} queryKey - The QueryKey to use when caching.
   * @param {Array} documents - The documents to cache (from MongoDB).
   *
   * @returns {void}
   */
  async cacheDocuments (queryKey, documents) {
    if (documents.length === 0) {
      debug('caching EMPTY_QUERY into QueryList')

      this.redis.lpush(queryKey.toString(), [EMPTY_QUERY.description])

      return
    }

    const { buckets, idCapture } = this.bucketify(documents)

    const hashes = Object.keys(buckets)

    debug(`caching ${documents.length} documents in ${hashes.length} buckets`)

    for (let i = 0; i < hashes.length; i++) {
      this.redis.hmset(hashes[i], buckets[hashes[i]]._)
    }

    this.redis.batchlpush(queryKey.toString(), idCapture)
  }

  /**
   * @typedef {Array} QueryList - An Array of id values associated with a particular query.
   */
  /**
   * Retrieves cached documents from a queryList.
   *
   * @param {Array} queryList - The list of document IDs.
   * @param {boolean} [stream=false] - Return as a stream.
   * @param {boolean} [ndjson=false] - When streaming, use the ndJSON spec.
   *
   * @returns {Array|Stream}
   */
  async lookupDocuments (queryList, stream = false, ndjson = false) {
    const cacheOps = this.debucketify(queryList)

    if (!stream) {
      debug(`looking up ${queryList.length} documents`)

      const rawDocuments = (await this.redis.multihmget(cacheOps)).flat()
      return rawDocuments.map((element) => JSON.parse(element))
    }

    const source = await this.redis.multihmget(cacheOps, true)
    const dest = PassThrough()

    pump(source, dest)

    return dest
  }

  /**
   * Determine which buckets need to be retrieved.
   *
   * @param {Array} queryList - The list of document IDs.
   *
   * @returns {Object} The cache operations to carry out.
   */
  debucketify (queryList) {
    if (!queryList || queryList.length === 0) return null

    const cacheOps = {}
    for (let i = 0; i < queryList.length; i++) {
      const documentID = queryList[i]
      const hash = hashFunction(documentID)

      const existingHash = cacheOps[hash]

      if (existingHash) existingHash.push(documentID)
      else cacheOps[hash] = [documentID]
    }

    return cacheOps
  }

  /**
   * Determine which buckets need to be cached.
   *
   * @param {Array} documents - Array of MongoDB documents to cache.
   *
   * @returns {Object}
   */
  bucketify (documents) {
    const buckets = {}
    const idCapture = []

    /* generate our cache operations */
    for (let i = 0; i < documents.length; i++) {
      const hexString = documents[i]._id.toHexString()

      idCapture.push(hexString)

      const hash = hashFunction(hexString)
      const existingBucket = buckets[hash]

      if (existingBucket) existingBucket.add(documents[i])
      else buckets[hash] = makeBucket(hash, documents[i])
    }

    return { buckets, idCapture }
  }

  /**
   * @typedef {Object} QueryMatch
   *
   * @property {Array} queryList - The list of document IDs.
   * @property {String} matchType - The type of match strategy used.
   */
  /**
   * Gets the queryList associated with the provided QueryKey
   * @param {QueryKey} queryKey - The QueryKey
   * @returns {QueryMatch}
   */
  async getQueryList (queryKey) {
    let matchType = null
    let queryList = await this.redis.lrange(queryKey.toString())

    if (!queryList || queryList.length === 0) {
      if (this.options.wideMatch) {
        queryList = await this.getWideMatch(queryKey)
        matchType = 'wide'
      } else {
        queryList = null
      }
    }

    return { queryList, matchType }
  }

  /**
   * Sets the queryList
   *
   * @param {QueryKey} queryKey - The QueryKey.
   * @param {Array} queryList - The list of document IDs.
   *
   * @returns {void}
   */
  async setQueryList (queryKey, queryList) {
    this.redis.batchlpush(queryKey.toString(), queryList)
  }

  /**
   * Gets the document ID associated with a particular query
   *
   * @param {String} queryHash - The hash name version of a query.
   * @param {String} query - The query to retreive.
   *
   * @returns {String} The document ID.
   */
  async getQueryHash (queryHash, query) {
    return this.redis.hget(queryHash, query)
  }

  /**
   * Sets a key-value pair in the queryHash
   *
   * @param {String} queryHash - The hash name version of a query.
   * @param  {...any} args - The query-documentID pair to set.
   *
   * @returns {void}
   */
  async setQueryHash (queryHash, ...args) {
    // [queryHash, query] = args
    return this.redis.hset(queryHash, args)
  }

  /**
   * Retrieve a single document from a bucket.
   *
   * @param {String} documentID - The document ID as a string.
   *
   * @returns {String} The document data.
   */
  async getDocument (documentID) {
    const hash = hashFunction(documentID)

    return this.redis.hget(hash, documentID)
  }

  /**
   * Caches a single document into an appropriate bucket.
   *
   * @param {Object} document - The document to cache.
   * @param {String|ObjectID} requestedID - The document ID as a ObjectID instance or String.
   *
   * @returns {void}
   */
  async setDocument (document, requestedID) {
    const documentID =
      document && document._id ? document._id.toHexString() : requestedID
    const hash = hashFunction(documentID)

    if (document) {
      document = JSON.stringify(document)
    } else {
      document = NULL_DOC.description
    }

    const args = [documentID, document]

    this.redis.hset(hash, args)
  }

  /**
   * Attempts to find a previously cached query that contains our requested data.
   *
   * @param {QueryKey} queryKey - The QueryKey.
   *
   * @returns {Array|null}
   */
  async getWideMatch (queryKey) {
    const scanPattern = `${queryKey.baseKey()}*`

    const [, cachedQueries] = await this.redis.scan(0, scanPattern)

    if (cachedQueries && cachedQueries.length > 0) {
      const pageOptions = validatePaginationOpts(queryKey.queryOptions)

      const { targetQuery, rangeOptions } =
        filterAvailableWideMatch(cachedQueries, pageOptions) || {}

      if (targetQuery && rangeOptions) {
        return this.redis.lrange(
          targetQuery,
          rangeOptions.start,
          rangeOptions.end - 1
        )
      }
    }

    return null
  }

  /**
   * Attempts to establish a connection to Redis
   *
   * @returns {void}
   */
  async connect () {
    return this.redis.connect()
  }

  /**
   * Attempts to close the Redis client collection.
   *
   * @returns {void}
   */
  async close () {
    return this.redis.close()
  }
}

module.exports = Cache
