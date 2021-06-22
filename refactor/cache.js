'use strict'

const cacheManager = require('cache-manager')

const log = require('util').debuglog('ff::cache')

class Cache {
    constructor (opts, mongod) {
        this.cache = cacheManager.caching(opts)
        this.mongod = mongod

        log(`🔥🧙‍♂️ IMLRU Cache created!`)
    }

    async get (key) {
        this.cache.wrap(key, function() {
            this.mongod.find(key)
        })
    }
}

module.exports = Cache