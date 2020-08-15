'use strict'

const { MongoClient, ObjectID } = require('mongodb')
const { FFError } = require('../utils/error')
const {
  filterOpts,
  MONGO_VANILLA_OPTS,
  FF_MONGO_DEFAULTS
} = require('../utils/options')

const stream = require('stream')
const debug = require('util').debuglog('fireferret::mongo')

/* internal */
let _ = null
let _options = {}
let _db = null
let _collection = null
let _connected = false

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
        _db.on('close', () => { _connected = false })
        this.dbName = _options.db
      }

      if (_options.collection && _db) {
        _collection = await _db.collection(_options.collection)
        this.collectionName = _options.collection
      }

      _connected = true

      debug(
        `mongo client connected to: db:${_options.db} with collection:${_options.collection}`
      )
    } catch (err) {
      throw new FFError('ConnectionError', '', err)
    }
  }

  async close () {
    _connected = false

    try {
      const reply = await _.close()

      debug('mongo client closed successfully')

      return reply
    } catch (err) {
      throw new FFError('ConnectionError', '', err)
    }
  }

  async findDocs (query = {}, options = {}) {
    try {
      const docs = await _collection.find(query, options).toArray()

      return docs
    } catch (err) {
      throw new FFError('MongoError', 'unable to find documents', 'mongo::findDocs', err)
    }
  }

  findDocsStream (query = {}, options = {}) {
    try {
      const docStream = stream.PassThrough()

      process.nextTick(async function () {
        const next = async function () {
          if (!_connected) return null

          try {
            const cursor = await _collection.find({ ...query, _id: { $gt: lastID } }, options)
            return cursor.limit(_options.streamDocumentSkip)
          } catch (err) {
            return null
          }
        }

        const first = async function () {
          if (!_connected) return null

          try {
            const cursor = await _collection.find(query, options).limit(_options.streamDocumentSkip)
            return cursor.limit(_options.streamDocumentSkip)
          } catch (err) {
            return null
          }
        }

        let lastID
        let firstWrite = true

        docStream.write('[')

        for (let docs = await first(); docs != null; docs = await next()) {
          /* the client is no longer connected! */
          if (!_connected || !docs) {
            break
          }

          let docsArray
          try {
            docsArray = await docs.toArray()
          } catch (err) {
            break
          }

          lastID = docsArray[docsArray.length - 1] ? docsArray[docsArray.length - 1]._id : null

          /* we're at the end */
          if (!lastID) {
            break
          }

          let stringified
          try {
            stringified = JSON.stringify(docsArray)
          } catch (err) {
            docStream.end(']')
            throw new FFError('MongoError', 'JSON stringified failed on one or more documents', 'mongo::findDocsStream', err)
          }

          const buffer = Buffer.from(`${firstWrite ? '' : ','}` + stringified.slice(1, -1), _options.encoding)

          docStream.write(buffer)
          firstWrite = false
        }

        docStream.end(']')
      })

      return docStream
    } catch (err) {
      console.error(err)
    }
  }

  async findOne (query) {
    try {
      const doc = await _collection.findOne(query)

      return doc
    } catch (err) {
      throw new FFError('MongoError', 'unable to find documents', 'mongo::findById', err)
    }
  }

  formatObjectID (idString) {
    return new ObjectID(idString)
  }
}

module.exports = Mongo
