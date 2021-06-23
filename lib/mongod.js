'use strict'

const { MongoClient } = require('mongodb')
const log = require('util').debuglog('ff::mongod')

class MongoDriver {
  constructor (uri, opts = {}) {
    this.client = new MongoClient(uri, { useUnifiedTopology: true, ...opts })
    this.db = null
    this.dbName = null

    if (opts.coll || opts.collection) this.collName = opts.coll ? opts.coll : opts.collection
  }

  async connect () {
    if (!this.client) throw new Error('Client DNE')

    await this.client.connect()
    this.db = this.client.db()
    this.dbName = this.db.databaseName

    log('🔥🥬 Connected to Mongod!')

    return [this.dbName, this.collName]
  }

  async close () {
    const reply = await this.client.close()

    log('🔥🥬 Connect to Mongod closed successfully!')

    return reply
  }

  async find (query, opts = {}) {
    log('🔥🥬 Find docs!')

    return this.db.collection(this.collName).find(query, opts).toArray()
  }
}

module.exports = MongoDriver
