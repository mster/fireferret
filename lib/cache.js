'use strict'

const pump = require('pump')
const sliced = require('sliced')
const matflap = require('matflap')
const { PassThrough } = require('stream')
const { createClient } = require('redis')
const { promisify } = require('util')
const { ObjectID } = require('mongodb')

const { makeBucket, hashFunction } = require('./bucket')
const {
  SYMBOLS: { NULL_DOC, EMPTY_QUERY },
  validatePaginationOpts,
  filterAvailableWideMatch,
  fastReverse
} = require('./utils')
const { FFError } = require('./error')

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
    this.redisOptions = redisOptions
    this.redis = null
  }

  setClient (client) {
    this.redis = client
  }

  /**
   * Attempts to establish a connection to Redis
   *
   * @returns {void}
   */
  async connect () {
    if (this.redis) return

    this.redis = createClient(this.redisOptions)

    this.redis.on('ready', () => {
      debug('redis server info', this.redis.server_info)
    })

    return new Promise((resolve, reject) => {
      this.redis.on('connect', () => {
        clearTimeout(timeout)

        debug('redis client connected')

        resolve('ok')
      })

      const timeout = setTimeout(() => {
        reject(
          new FFError(
            'ConnectionError',
            'failed to connected before timeout',
            'redis::connect',
            { timeout: this.redisOptions.connectionTimeout }
          )
        )
      }, this.redisOptions.connectionTimeout)
    })
  }

  /**
   * Attempts to close the Redis client collection.
   *
   * @returns {void}
   */
  async close () {
    const _quit = promisify(this.redis.quit).bind(this.redis)

    try {
      const reply = await _quit()

      debug('redis client closed successfully')

      return reply
    } catch (err) {
      throw new FFError(
        'ConnectionError',
        'close operation has failed -- quit must be invoked',
        'redis::close',
        err
      )
    }
  }

  /**
   * Sets the queryList and caches documents into Redis.
   * @param {QueryKey} queryKey - The QueryKey to use when caching.
   * @param {Array} documents - The documents to cache (from MongoDB).
   *
   * @returns {void}
   */
  async setDocuments (queryKey, documents) {
    if (documents.length === 0) {
      debug('caching EMPTY_QUERY into QueryList')

      this.lpush(queryKey.toString(), [EMPTY_QUERY.description])

      return
    }

    const { buckets, idCapture } = this.bucketify(documents)

    const hashes = Object.keys(buckets)

    debug(`caching ${documents.length} documents in ${hashes.length} buckets`)

    for (let i = 0; i < hashes.length; i++) {
      this.hmset(hashes[i], buckets[hashes[i]]._)
    }

    this.batchlpush(queryKey.toString(), idCapture)
  }

  /**
   * @typedef {Array} QueryList - An Array of id values associated with a particular query.
   */
  /**
   * Retrieves cached documents from a queryList.
   *
   * @param {Array} queryList - The list of document IDs.
   * @param {Object} [options={}]
   * @param {boolean} [options.hydrate=false] - JSON.parse documents and attempt to reformat types (performance hit).
   * @param {boolean} [options.stream=false] - Return as a stream.
   * @param {boolean} [options.ndjson=false] - When streaming, use the ndJSON spec.
   *
   * @returns {Array|Stream}
   */
  async getDocuments (queryList, options) {
    if (!options) options = {}

    const cacheOps = this.debucketify(queryList)

    if (!options.stream) {
      debug(`looking up ${queryList.length} documents`)

      const rawDocuments = await this.multihmget(cacheOps)

      const dateFormat = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/
      const hydrate = options.hydrate
        ? (d) =>
          JSON.parse(d, (key, value) => {
            if (key === '_id') return ObjectID(value)
            else if (typeof value === 'string' && dateFormat.test(value)) {
              return new Date(value)
            } else return value
          })
        : (d) => JSON.parse(d)

      /* hydrate similar to mongoose */
      return matflap(rawDocuments, hydrate)
    }

    const source = await this.multihmget(cacheOps, true)
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
    let queryList = await this.lrange(queryKey.toString())

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
    this.batchlpush(queryKey.toString(), queryList)
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
    return this.hget(queryHash, query)
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
    return this.hset(queryHash, args)
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

    return this.hget(hash, documentID)
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

    this.hset(hash, args)
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

    const [, cachedQueries] = await this.scan(0, scanPattern)

    if (cachedQueries && cachedQueries.length > 0) {
      const pageOptions = validatePaginationOpts(queryKey.queryOptions) || {}

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

  /* Single operation wrappers */
  async hget (hash, field) {
    const _hget = promisify(this.redis.hget).bind(this.redis)

    try {
      return _hget(hash, field)
    } catch (err) {
      throw new FFError(
        'RedisError',
        'hget operation has failed',
        'redis::hget',
        err
      )
    }
  }

  async hmget (key, fields) {
    const _hmget = promisify(this.redis.hmget).bind(this.redis)

    try {
      return _hmget(key, fields)
    } catch (err) {
      throw new FFError(
        'RedisError',
        'hmget operation has failed',
        'redis::hmget',
        err
      )
    }
  }

  async hset (hash, args) {
    const _hset = promisify(this.redis.hset).bind(this.redis)

    try {
      await _hset(hash, args)
    } catch (err) {
      debug(err)
      throw new FFError(
        'RedisError',
        'hset operation has failed',
        'redis::hset',
        err
      )
    }
  }

  async hmset (key, args) {
    const _hmset = promisify(this.redis.hmset).bind(this.redis)

    try {
      await _hmset(key, args)
    } catch (err) {
      throw new FFError(
        'RedisError',
        'hmset operation has failed',
        'redis::hmset',
        err
      )
    }
  }

  async lrange (key, start, end) {
    const _lrange = promisify(this.redis.lrange).bind(this.redis)

    try {
      if (start || end) {
        start = start || 0
        end = end || -1

        return _lrange(key, start, end)
      }

      return _lrange(key, 0, -1)
    } catch (err) {
      throw new FFError(
        'RedisError',
        'lrange operation has failed',
        'redis::lrange',
        err
      )
    }
  }

  async lpush (key, elements, reverse = true) {
    if (!key || key.length === 0) {
      throw new FFError(
        'InvalidArguments',
        'valid key is required for lpush',
        'redis::lpush',
        { key }
      )
    }

    if (!elements || elements.length === 0) {
      throw new FFError(
        'InvalidArguments',
        'Elements are required for lpush',
        'redis::lpush',
        { elements }
      )
    }

    const _lpush = promisify(this.redis.lpush).bind(this.redis)
    if (reverse) fastReverse(elements)

    try {
      const reply = await _lpush(key, ...elements)

      return reply
    } catch (err) {
      throw new FFError(
        'RedisError',
        'lpush operation has failed',
        'redis::lpush',
        err
      )
    }
  }

  async scan (cursor, pattern, count = this.redisOptions.count) {
    if ((!cursor && cursor !== 0) || !pattern) {
      throw new FFError(
        'RedisError',
        'cursor and pattern are required parameters for a SCAN operation',
        'redis::scan',
        { cursor, pattern }
      )
    }

    const _scan = promisify(this.redis.scan).bind(this.redis)

    try {
      const elements = _scan(cursor, 'MATCH', pattern, 'COUNT', count)

      return elements
    } catch (err) {
      throw new FFError(
        'RedisError',
        'scan operation has failed',
        'redis::scan',
        err
      )
    }
  }

  /* Async multi operations */
  async multihmget (operations, stream) {
    const hashes = Object.keys(operations)

    if (!stream) {
      const multi = this.redis.multi()

      for (let i = 0; i < hashes.length; i++) {
        multi.hmget(hashes[i], operations[hashes[i]])
      }

      const exec = promisify(multi.exec).bind(multi)

      try {
        const collation = await exec()

        return collation
      } catch (err) {
        throw new FFError(
          'RedisError',
          'one or more hgetall operations have failed',
          'redis::multihmget',
          err
        )
      }
    }

    /* using streams */
    const source = PassThrough()
    const sink = PassThrough()

    let fresh = true
    for (
      let i = 0, hash = hashes[i];
      i < hashes.length;
      i++, hash = hashes[i]
    ) {
      this.hmget(hash, operations[hash]).then((bucket) => {
        source.write(
          `${
            (fresh && !this.redisOptions.ndJSON ? '[' : '') +
            bucket.join(!this.redisOptions.ndJSON ? ',' : '\n')
          }`
        )
        fresh = false

        /* if this is the last bucket, end the stream appropriately */
        if (this.redisOptions.ndJSON && i === hashes.length - 1) source.end()
        if (!this.redisOptions.ndJSON && i === hashes.length - 1) {
          source.end(']')
        } else if (!this.redisOptions.ndJSON) {
          /* 'join' the batches together (array return) */
          source.write(',')
        }
      })
    }

    pump(source, sink)

    return sink
  }

  /* Batch operations wrap single operation */
  async batchlpush (key, elements, batchSize = this.redisOptions.batchSize) {
    if (batchSize > elements.length) return this.lpush(key, elements, true)

    const elementCount = elements.length
    const batchOps = []

    /* retain document parity with mongo */
    fastReverse(elements)

    for (let i = 0; i < Math.ceil(elementCount / batchSize); i += 1) {
      const end =
        elementCount < (i + 1) * batchSize ? elementCount : (i + 1) * batchSize
      const batch = sliced(elements, i * batchSize, end)
      if (batch.length > 0) batchOps.push(this.lpush(key, batch, false))
    }

    return Promise.all(batchOps)
  }
}

module.exports = Cache
