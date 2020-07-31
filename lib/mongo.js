'use strict'

const { MongoClient } = require('mongodb')
const { FFError } = require('./utils/error')

const debug = require('util').debuglog('fireferret::mongo')

/* internal */
let _ = null
let _options = {}
let _db = null
let _collection = null

class Mongo {
  constructor (uri, options) {
    _options = options || {}
    _ = new MongoClient(uri, {
      useUnifiedTopology: true
    })

    this.collectionName = ''
    this.dbName = ''
  }

  async connect () {
    try {
      const client = await _.connect()
      _ = client

      if (_options.db) {
        _db = _.db(_options.db)
        this.dbName = _options.db
      }

      if (_options.collection && _db) {
        _collection = await _db.collection(_options.collection)
        this.collectionName = _options.collection
      }

      debug(
        `mongo client connected to: db:${_options.db} with collection:${_options.collection}`
      )
    } catch (err) {
      throw new FFError('ConnectionError', '', err)
    }
  }

  async close () {
    try {
      const reply = await _.close()

      debug('mongo client closed successfully')

      return reply
    } catch (err) {
      throw new FFError('ConnectionError', '', err)
    }
  }

  async findDocs (query, options) {
    try {
      const docs = await _collection.find(query).toArray()

      return docs
    } catch (err) {
      throw new FFError('MongoError', '', err)
    }
  }

  async findById (id) {
    try {
      const doc = await _collection.find({ _id: id })

      return doc
    } catch (err) {
      throw new FFError('MongoError', '', err)
    }
  }
}

module.exports = Mongo
