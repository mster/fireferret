'use strict'

const pump = require('pump')
const through = require('through2')
const { MongoClient, ObjectID } = require('mongodb')
const { FFError } = require('./error')
const {
  filterOpts,
  MONGO_VANILLA_OPTS,
  FF_MONGO_DEFAULTS
} = require('./options')

const debug = require('util').debuglog('fireferret::mongo')
const { PassThrough } = require('stream')

/* internal */
let _ = null
let _options = {}
let _db = null
let _collection = null

class Mongo {
  constructor (uri, options) {
    _options = {
      ...FF_MONGO_DEFAULTS,
      ...filterOpts(options, { ...MONGO_VANILLA_OPTS, ...FF_MONGO_DEFAULTS })
    }

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

  async findDocs (query = {}, options = {}, stream = false) {
    if (!stream) {
      try {
        const docs = await _collection.find(query, options).toArray()

        return docs
      } catch (err) {
        throw new FFError(
          'MongoError',
          'unable to find documents',
          'mongo::findDocs',
          err
        )
      }
    }

    return this.findDocsStream(query, options)
  }

  async findDocsStream (query = {}, options = {}) {
    const source = _collection.find(query, options)
    const xform = through.obj(function (chunk, enc, cb) {
      this.push(JSON.stringify(chunk) + '\n')
      cb()
    })
    const sink = PassThrough()

    pump(source, xform, sink)

    return sink
  }

  async findOne (query) {
    try {
      const doc = await _collection.findOne(query)

      return doc
    } catch (err) {
      throw new FFError(
        'MongoError',
        'unable to find documents',
        'mongo::findById',
        err
      )
    }
  }

  formatObjectID (idString) {
    return new ObjectID(idString)
  }
}

module.exports = Mongo
