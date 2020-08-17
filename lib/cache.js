'use strict'

const RedisClient = require('./redis')
const {
  SYMBOLS: { EMPTY_QUERY, NULL_DOC },
  validatePaginationOpts,
  filterAvailableWideMatch,
  toFlatmap
} = require('./utils')

class Cache {
  constructor (options, redisOptions) {
    this.redis = new RedisClient(redisOptions)
    this.options = options
  }

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

    const [, cachedQueries] = await this.redis.scan(0, scanPattern, 1e6)

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
