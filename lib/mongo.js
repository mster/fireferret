'use strict'

const pump = require('pump')
const through = require('through2')
const { MongoClient } = require('mongodb')
const { PassThrough } = require('stream')

const { FerretError } = require('./error')

const debug = require('util').debuglog('fireferret::mongo')

/* internal */
let _client = null
let _options = {}
let _db = null
let _collection = null

class Mongo {
  constructor (uri, options, clientOptions) {
    _options = options
    _client = new MongoClient(uri, clientOptions)

    this.dbName = _options.dbName || ''
    this.collectionName = _options.collectionName || ''
  }

  /**
   * Internal - Using this may induce unintended behaviors.
   * @param {MongoClient} client - A npm::mongodb client
   */
  _setClient (client) {
    if (client) _client = client
  }

  /**
   * Internal - Using this may induce unintended behaviors.
   * @returns An npm::mongodb client.
   */
  _getClient () {
    return _client
  }

  /**
   * Attempts to establish a connection to MongoDB.
   */
  async connect () {
    try {
      const client = await _client.connect()
      _client = client
      _db = this.dbName ? _client.db(this.dbName) : _client.db()

      if (this.collectionName && _db) {
        _collection = await _db.collection(_options.collectionName)
      }

      debug(
        `mongo client connected to: db:${_options.dbName} with collection:${_options.collectionName}`
      )
    } catch (err) {
      throw new FerretError(
        'ConnectionError',
        'Unable to connect to MongoDB resource.',
        'mongo::connect',
        err
      )
    }
  }

  /**
   * Attempts to close the connection to MongoDB.
   */
  async close () {
    try {
      const reply = await _client.close()

      debug('mongo client closed successfully')

      return reply
    } catch (err) {
      throw new FerretError('ConnectionError', '', err)
    }
  }

  /**
   * Select and return documents from a collection.
   * @param {QueryKey} queryKey - A QueryKey instance.
   * @param {Object} options - Query options.
   * @returns {Array} An array of JSON documents.
   */
  async findDocs (queryKey, options = {}) {
    const query = queryKey.query

    try {
      /* using the default collection */
      if (queryKey.collectionName === this.collectionName) {
        return _collection.find(query, options).toArray()
      }

      /* using passed collectionName */
      return _db
        .collection(queryKey.collectionName)
        .find(query, options)
        .toArray()
    } catch (err) {
      throw new FerretError(
        'MongoError',
        'unable to find documents',
        'mongo::findDocs',
        err
      )
    }
  }

  /**
   * Select and return a stream of documents from a collection.
   * @param {QueryKey} queryKey - A QueryKey instance.
   * @param {Object} options - Query options.
   * @returns {Object} A readable stream and array of captured stream documents.
   */
  async findDocsStream (queryKey, options = {}) {
    const query = queryKey.query

    const source =
      queryKey.collectionName === this.collectionName
        ? _collection.find(query, options)
        : _db.collection(queryKey.collectionName).find(query, options)

    let fresh = true
    const capture = []
    const xform = through.ctor(
      { objectMode: true },
      transform,
      _options.ndJSON ? null : flush
    )()
    const sink = PassThrough()

    pump(source, xform, sink)

    return { sink, capture }

    function transform (document, enc, cb) {
      /* for caching internal caching operation */
      capture.push(document)

      const stringified = JSON.stringify(document)
      if (stringified && _options.ndJSON) {
        /* ndJSON spec */
        this.push(`${stringified}\n`)
      } else if (stringified) {
        /* array */
        this.push(`${(fresh ? '[' : ',') + stringified}`)
        fresh = false
      } else {
        this.push(null)
      }
      cb()
    }

    function flush (done) {
      if (capture.length === 0) this.push('[')
      this.push(']')
      done()
    }
  }

  /**
   * Select and return the first document from a collection.
   * @param {QueryKey} queryKey - A QueryKey instance.
   * @returns {Object}
   */
  async findOne (queryKey) {
    const query = queryKey.query

    try {
      if (queryKey.collection !== this.collectionName) {
        return _db.collection(queryKey.collectionName).findOne(query)
      }
      return _collection.findOne(query)
    } catch (err) {
      throw new FerretError('MongoError', err.msg, 'mongo::findById', err)
    }
  }
}

module.exports = Mongo
