'use strict'

const {
  SYMBOLS: { EMPTY_QUERY, CACHE_MISS, CACHE_HIT, NULL_DOC },
  validatePaginationOpts,
  getQueryVerdict
} = require('./utils')
const { FFError } = require('./error')
const { QueryKey } = require('./key')

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

  const queryKey = new QueryKey(
    this.mongo.dbName,
    this.mongo.collectionName,
    query,
    options
  )

  const queryList = await this.cache.getQueryList(queryKey)

  const verdict = getQueryVerdict(queryList)
  debug(verdict.description, '@', queryKey.toString())

  if (CACHE_HIT === verdict) {
    return this.cache.getDocuments(queryList)
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

    const documents = await this.mongo.findDocs(
      queryKey.query,
      mongoQueryOptions
    )

    this.cache.setQueryDocuments(queryKey.toString(), documents)

    return documents
  }

  if (EMPTY_QUERY === verdict) {
    /* no document(s) found */
    return null
  }
}

module.exports.fetchById = async function (documentID) {
  if (!documentID || documentID.constructor.name !== 'String') {
    throw new FFError(
      'InvalidOptions',
      'documentID is a required parameter and must be of type String',
      'fetch::fetchById',
      { documentID }
    )
  }

  let objectID
  try {
    objectID = this.mongo.formatObjectID(documentID)
  } catch (err) {
    /* invalid ObjectID, return null aka empty query */
    return null
  }

  const document = await this.cache.getDocument(documentID)

  if (!document) {
    debug('cache miss', { _id: documentID })

    let doc = await this.mongo.findDocs({ _id: objectID })
    if (!doc || !doc._id) doc = null

    this.cache.setDocument(documentID, doc)

    return doc
  }

  debug('cache hit', { _id: documentID })

  return document === NULL_DOC ? null : document
}

module.exports.fetchOne = async function (query) {
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
    this.cache.setDocument(documentID, document)

    return document
  }

  debug('cache hit', oneKey, queryString)
  return this.cache.getDocument(documentID)
}
