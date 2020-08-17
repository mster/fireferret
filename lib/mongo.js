'use strict'

const { MongoClient, ObjectID } = require('mongodb')
const { FFError } = require('./error')
const {
  filterOpts,
  validatePaginationOpts,
  MONGO_VANILLA_OPTS,
  FF_MONGO_DEFAULTS
} = require('./options')

const stream = require('stream')
const debug = require('util').debuglog('fireferret::mongo')
const slice = require('sliced')

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
        _db.on('close', () => {
          _connected = false
        })
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
      throw new FFError(
        'MongoError',
        'unable to find documents',
        'mongo::findDocs',
        err
      )
    }
  }

  findDocsStream (query = {}, options = {}) {
    try {
      const docStream = stream.PassThrough()
      const { start, end } = validatePaginationOpts(options)
      let firstWrite = true

      const tickStream = async function (ID, remainder) {
        process.nextTick(async function () {
          const next = async function () {
            if (!_connected) return null

            try {
              const cursor = await _collection.find(
                ID ? { ...query, _id: { $gt: ID } } : query,
                options
              )
              return cursor
                .limit(
                  _options.streamDocumentSkip > remainder
                    ? remainder
                    : _options.streamDocumentSkip
                )
                .toArray()
            } catch (err) {
              return null
            }
          }

          const nextBatch = await next()
          if (nextBatch) {
            const lastId = nextBatch[nextBatch.length - 1]
              ? nextBatch[nextBatch.length - 1]._id
              : null

            if (!lastId) {
              docStream.end(']')
              return
            }

            const buffer = Buffer.from(
              `${firstWrite ? '' : ','}` +
                slice(JSON.stringify(nextBatch), 1, -1),
              _options.encoding
            )
            docStream.write(buffer)
            firstWrite = false

            tickStream(
              lastId,
              _options.streamDocumentSkip > remainder
                ? 0
                : remainder - _options.streamDocumentSkip
            )
            return
          }

          docStream.end(']')
        })
      }

      docStream.write('[')

      if (start && end) tickStream('', end - start)
      else if (!start && !end) tickStream('', Infinity)

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
