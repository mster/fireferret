'use strict'

const RedisClient = require('./redis')
const { makeBucket, hashFunction } = require('./bucket')
const {
  SYMBOLS: { EMPTY_QUERY, NULL_DOC },
  validatePaginationOpts,
  filterAvailableWideMatch,
  toFlatmap
} = require('./utils')
const debug = require('util').debuglog('fireferret::cache')

class Cache {
  constructor (options, redisOptions) {
    this.redis = new RedisClient(redisOptions)
    this.options = options
  }

  async cacheDocuments (queryKey, documents) {
    const { cacheOps, ids } = this.bucketify(documents)

    const hashes = Object.keys(cacheOps)

    debug(`caching ${documents.length} documents in ${hashes.length} buckets`)

    for (let i = 0; i < hashes.length; i++) {
      this.redis.hmset(hashes[i], cacheOps[hashes[i]]._)
    }

    this.redis.batchlpush(queryKey.toString(), ids)
  }

  async lookupDocuments (queryList) {
    const cacheOps = this.debucketify(queryList)

    debug(`looking up ${queryList.length} documents`)

    return this.redis.multihmget(cacheOps)
  }

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

  bucketify (documents) {
    const cacheOps = {}
    const ids = []

    /* generate our cache operations */
    for (let i = 0; i < documents.length; i++) {
      const hexString = documents[i]._id.toHexString()

      ids.push(hexString)

      const hash = hashFunction(hexString)
      const existingBucket = cacheOps[hash]

      if (existingBucket) existingBucket.add(documents[i])
      else cacheOps[hash] = makeBucket(hash, documents[i])
    }

    return { cacheOps, ids }
  }

  async getBuckets (hdmap) {
    const collation = []
    const hashes = Object.keys(hdmap)

    for (let i = 0; i < hashes.length; i++) {
      const bucketContents = await this.redis.hmget(hashes[i], hdmap[hashes])
      collation.push(bucketContents)
    }

    return collation
  }

  async setBuckets (buckets) {}

  /* returns a list of documentIDs that fit the query */
  async getQueryList (queryKey) {
    let queryList = await this.redis.lrange(queryKey.toString())

    if (!queryList || queryList.length === 0) {
      if (this.options.wideMatch) {
        queryList = await this.getWideMatch(queryKey)
      } else {
        queryList = null
      }
    }

    return queryList
  }

  async getQueryHash (queryHash, query) {
    return this.redis.hget(queryHash, query)
  }

  /* returns documents from a documentID list */
  async getDocuments (documentsIDs) {
    const batch = await this.redis.batchhgetall(documentsIDs)
    const docs = []

    /* (docsCount / batchSize) operations */
    let i = 0
    const batchLength = batch.length
    for (; i < batchLength; i++) {
      docs.push(...batch[i].filter((e) => e != null))
    }

    return docs
  }

  async getDocument (documentID) {
    let documentHash = await this.redis.hgetall(documentID)

    // flatmap
    if (documentHash && documentHash.value === NULL_DOC.description) {
      documentHash = NULL_DOC
    }

    return documentHash || null
  }

  async setQueryHash (queryHash, ...args) {
    // [queryHash, query] = args
    return this.redis.hset(queryHash, args)
  }

  async setDocument (documentID, props) {
    if (props) {
      props = toFlatmap(props)
    }

    if (props == null) {
      props = ['value', NULL_DOC.description]
    }

    return this.redis.hset(documentID, props)
  }

  /* sets queryList and document hashes */
  async setQueryDocuments (queryKey, documents) {
    const documentsIDs = []
    const documentHashes = []

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i]

      const stringID = doc._id.toString()
      documentsIDs.push(stringID)

      const args = toFlatmap(doc)
      documentHashes.push({ hname: stringID, args })
    }

    const length = documentsIDs.length

    if (length === 0) {
      this.redis.lpush(queryKey.toString(), [EMPTY_QUERY.description])
      return
    }

    /* if length < batchSize use single lpush */

    this.redis.batchlpush(queryKey.toString(), documentsIDs)
    this.redis.batchhset(documentHashes)
  }

  /* returns a previous superqueries that contain our subquery (or none) */
  async getWideMatch (queryKey) {
    const scanPattern = `${queryKey.baseKey()}*`

    const [, cachedQueries] = await this.redis.scan(0, scanPattern)

    if (cachedQueries && cachedQueries.length > 0) {
      const pageOptions = validatePaginationOpts(queryKey.queryOptions)

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

  /* connect wrapper for Redis */
  async connect () {
    return this.redis.connect()
  }

  /* close wrapper for Redis */
  async close () {
    return this.redis.close()
  }
}

module.exports = Cache
