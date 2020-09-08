'use strict'

const { ObjectID } = require('mongodb')

const MongoClient = require('./mongo')
const Cache = require('./cache')
const { generateOptions } = require('./options')
const {
  SYMBOLS: { EMPTY_QUERY, CACHE_MISS, CACHE_HIT, NULL_DOC },
  validatePaginationOpts
} = require('./utils')
const { FFError } = require('./error')
const { QueryKey } = require('./key')

const debug = require('util').debuglog('fireferret::main')

/**
 * Creates a new FireFerret instance
 * @constructor
 * @param {options.FireFerretOptions} options - FireFerret configuration options
 * @returns {FireFerret}
 */
class FireFerret {
  constructor (options) {
    const mongoOpts = generateOptions(options.mongo, 'mongo')
    const cacheOpts = generateOptions(options, 'cache')

    const mongoClientOpts = generateOptions(options.mongo, 'mongoClient')
    const redisClientOpts = generateOptions(options.redis, 'redisClient')

    this.mongo = new MongoClient(mongoOpts.uri, mongoOpts, mongoClientOpts)
    this.cache = new Cache(cacheOpts, redisClientOpts)

    debug('FireFerret client created')
  }

  /**
   * Establish a connection to both data stores.
   * @returns {string} The connection status.
   */
  async connect () {
    await this.cache.connect()
    await this.mongo.connect()

    return 'ok'
  }

  /**
   * Gracefully close all active connections.
   * @returns {string} The close status.
   */
  async close () {
    await this.cache.close()
    await this.mongo.close()

    return 'ok'
  }

  /**
   * @typedef {Object} Query
   * You can find more information on querying documents {@link https://docs.mongodb.com/manual/tutorial/query-documents/|here}.
   *
   * @example
   * { name: { $in: ['Foo', 'Bar'] } }
   */
  /**
   * Fetch MongoDB documents from a query.
   *
   * @param {Query} [query={}] - An optional cursor query object.
   * @param {Object} [options={}] - Optional settings.
   * @param {Boolean} [options.hydrate=false] - JSON.parse documents and attempt to reformat types (performance hit).
   * @param {Boolean} [options.stream=false] - Return the documents as a stream.
   * @param {Boolean} [options.wideMatch=false] - Use Wide-Match strategy.
   *
   * @returns {Array|null} documents
   */
  async fetch (query, options) {
    if (!options) options = {}
    if (!query) query = {}

    const queryKey = new QueryKey(
      this.mongo.dbName,
      this.mongo.collectionName,
      query,
      options
    )

    const { queryList, matchType } = await this.cache.getQueryList(queryKey)

    const verdict =
      !queryList || queryList.length === 0
        ? CACHE_MISS
        : queryList && queryList[0] === EMPTY_QUERY.description
          ? EMPTY_QUERY
          : CACHE_HIT
    debug(verdict.description, '@', queryKey.toString())

    if (CACHE_HIT === verdict) {
      /* check match type and cache new QL if needed */
      if (matchType === 'wide') {
        this.cache.setQueryList(queryKey, queryList)
      }

      return this.cache.lookupDocuments(queryList, {
        stream: options.stream,
        hydrate: options.hydrate
      })
    }

    if (CACHE_MISS === verdict) {
      const pageOptions = validatePaginationOpts(options)
      const mongoQueryOptions = {}

      /* with pagination */
      if (pageOptions) {
        mongoQueryOptions.skip = pageOptions.start
        mongoQueryOptions.limit = pageOptions.size

        debug('using pagination', mongoQueryOptions)
      }

      if (!options.stream) {
        const documents = await this.mongo.findDocs(
          queryKey.query,
          mongoQueryOptions
        )

        /* cache query */
        this.cache.cacheDocuments(queryKey, documents)

        return documents
      }

      const { sink, capture } = await this.mongo.findDocsStream(
        queryKey.query,
        mongoQueryOptions
      )

      /* wait for Mongo to finish streaming us docs, then do a cache operation */
      sink.on('end', () => {
        /* only cache if we need to */
        if (capture.length > 0) this.cache.cacheDocuments(queryKey, capture)
      })

      return sink
    }

    if (EMPTY_QUERY === verdict) {
      /* no document(s) found */
      return null
    }
  }

  /**
   * Fetch one MongoDB document from an ID string.
   *
   * @param {String} documentID - The `_id` of the requested document.
   *
   * @returns {Object|null} The document.
   */
  async fetchById (documentID, options) {
    if (!options) options = {}

    if (!documentID) {
      throw new FFError(
        'InvalidOptions',
        'documentID is a required parameter.',
        'fetch::fetchById',
        { documentID }
      )
    }

    if (documentID.constructor === ObjectID) { documentID = documentID.toHexString() }
    if (documentID.constructor !== String) {
      return new FFError(
        'InvalidOptions',
        'documentID must be of type String or ObjectID',
        'client::fetchById',
        { documentID }
      )
    }

    const document = await this.cache.getDocument(documentID)

    if (document == null) {
      debug('cache miss', { _id: documentID })

      let doc = await this.mongo.findDocs({ _id: documentID })
      if (!doc || !doc._id) doc = null

      this.cache.setDocument(doc, documentID)

      return doc
    }

    debug('cache hit', { _id: documentID })
    if (document === NULL_DOC.description) return null

    const dateFormat = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/
    const parsed = options.hydrate
      ? JSON.parse(document, (key, value) => {
        if (key === '_id') return ObjectID(value)
        else if (typeof value === 'string' && dateFormat.test(value)) {
          return new Date(value)
        } else return value
      })
      : JSON.parse(document)
    return parsed
  }

  /**
   * Fetch the first MongoDB document from a query.
   *
   * @param {Object} [query={}] - An optional cursor query object.
   *
   * @returns {Object|null} The document.
   */
  async fetchOne (query, options) {
    if (!options) options = {}

    const queryKey = new QueryKey(
      this.mongo.dbName,
      this.mongo.collectionName,
      query,
      null
    )

    const oneKey = queryKey.oneKey()
    const queryString = queryKey.queryString()

    const documentID = await this.cache.getQueryHash(oneKey, queryString)

    if (!documentID) {
      debug('cache miss', oneKey, queryString)
      let document = await this.mongo.findOne(query)

      if (!document || !document._id) {
        document = null
      }

      const documentID = document
        ? document._id.toString()
        : EMPTY_QUERY.description

      this.cache.setQueryHash(oneKey, queryString, documentID)
      this.cache.setDocument(document)

      return document
    }

    debug('cache hit', oneKey, queryString)
    const document = await this.cache.getDocument(documentID)

    if (document === NULL_DOC.description) return null

    const dateFormat = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/
    const parsed = options.hydrate
      ? JSON.parse(document, (key, value) => {
        if (key === '_id') return ObjectID(value)
        else if (typeof value === 'string' && dateFormat.test(value)) {
          return new Date(value)
        } else return value
      })
      : JSON.parse(document)
    return parsed
  }
}

module.exports = FireFerret
