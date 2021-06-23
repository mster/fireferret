'use strict'

const MongoDriver = require('./mongod')
const queryKey = require('./util/queryKey')
const hash = require('./util/hash')
const cacheManager = require('cache-manager')
const { promisify } = require('util')

const log = require('util').debuglog('ff::client')

class FireFerretClient {
  constructor (opts = {}) {
    this.mongod = new MongoDriver(opts.uri, { coll: opts.coll })
    this.activeDb = null
    this.activeCollection = opts.coll || opts.collection || null

    this.cache = cacheManager.caching({
      store: opts.store,
      driver: opts.driver || null,
      host: opts.host,
      port: opts.port,
      db: opts.db,
      ttl: opts.ttl
    })
  }

  async connect () {
    const [dbName, collName] = await this.mongod.connect()
    this.activeDb = dbName
    this.activeCollection = collName

    const collText = this.activeCollection ? ` with collection=${this.activeCollection}` : ''
    log(`🔥🐈 FireFerret connected to db=${this.activeDb}${collText}`)

    return 'ok'
  }

  async close () {
    await this.mongod.close()

    if (this.cache.store.getClient) {
      const cacheClient = this.cache.store.getClient(() => process.exit(0))

      if (cacheClient && cacheClient.quit) {
        cacheClient.quit()
        return 'ok'
      }

      if (cacheClient && cacheClient.close) {
        cacheClient.close()
        return 'ok'
      }
    }

    return 'ok'
  }

  async find (query, opts = {}, collectionName = null) {
    // reduce expensive mongodb lookups

    const loadFromDB = async () => {
      const docs = await this.mongod.find(query, { skip: low, limit: size })

      // O(# of docs)
      const hmap = {}; const idmap = {}
      docs.forEach(doc => {
        const id = doc._id.toHexString()
        const hashId = hash(id)

        if (hmap[hashId]) hmap[hashId].push(doc)
        else hmap[hashId] = [doc]

        if (idmap[hashId]) idmap[hashId].push(id)
        else idmap[hashId] = [id]
      })

      // O(# of docs / 512)
      const hashes = Object.keys(hmap)
      hashes.forEach(bucketKey => {
        // set docs (ordered) inside buckets by hash
        this.cache.set(bucketKey, hmap[bucketKey])
      })

      // set query contents
      this.cache.set(qK, idmap) // no need to wait

      log('🔥❌ Cache miss!')
      return docs
    }

    const loadFromCache = async () => {
      const idmap = await this.cache.get(match); const buckets = Object.keys(idmap); const docs = []
      let partialFulfillment = false

      // O(# of docs / 512)
      for (const bucketKey of buckets) {
        const bucketConents = await this.cache.get(bucketKey)

        // bucket DNE;
        if (!bucketConents || bucketConents.length === 0) {
          partialFulfillment = true
          break
        }

        // if we need the whole bucket, there is no need to filter!
        if (idmap[bucketKey].length === 512) {
          docs.push(...bucketConents)
          continue
        }

        // filter out docs that are only included in the query
        // array to dict for constant lookup
        const bucketDict = {}
        bucketConents.forEach(doc => {
          bucketDict[doc._id] = doc
        })

        // all doc ids in the query
        for (const id of idmap[bucketKey]) {
          if (bucketDict[id]) docs.push(bucketDict[id])
          else {
            partialFulfillment = true
            break
          }
        }

        // break out early to avoid extra work
        if (partialFulfillment) break
      }

      // partial fulfillment is worthless, reload entire query from DB
      if (partialFulfillment) return loadFromDB()

      log('🔥✅ Cache hit!')
      return docs
    }

    const loadSubsetFromCache = async () => {
      const idmap = await this.cache.get(match); const bucketKeys = Object.keys(idmap); const docs = []; const loadOp = {}

      const desiredLen = high - low
      let currLen = 0; let [remainingOffset] = matchDiff; let remaining = desiredLen

      for (const bucketKey of bucketKeys) {
        if (desiredLen <= currLen) break

        const bucketLen = idmap[bucketKey].length

        if (remainingOffset >= bucketLen) {
          remainingOffset -= bucketLen

          continue
        }

        if (remainingOffset !== 0 && remainingOffset < bucketLen) {
          const start = remainingOffset
          const end = remaining < bucketLen - remainingOffset ? start + remaining : undefined

          const segmentLen = end ? end - start : bucketLen - start
          currLen += segmentLen
          remainingOffset = 0
          remaining -= segmentLen

          const ids = idmap[bucketKey].slice(start, end)
          loadOp[bucketKey] = ids

          continue
        }

        // add all of bucket
        if (remainingOffset === 0 && remaining >= bucketLen) {
          loadOp[bucketKey] = idmap[bucketKey]

          remaining -= bucketLen
          currLen += bucketLen

          continue
        }

        if (remainingOffset === 0 && remaining < bucketLen) {
          const ids = idmap[bucketKey].slice(0, remaining + 1)
          loadOp[bucketKey] = ids

          remaining = 0
          currLen += remaining

          continue
        }
      }

      let partialFulfillment = false

      for (const bucketKey of Object.keys(loadOp)) {
        const bucketConents = await this.cache.get(bucketKey)

        // bucket DNE;
        if (!bucketConents || bucketConents.length === 0) {
          partialFulfillment = true
          break
        }

        // if we need the whole bucket, there is no need to filter!
        if (loadOp[bucketKey].length === 512) {
          docs.push(...bucketConents)
          continue
        }

        // filter out docs that are only included in the query
        // array to dict for constant lookup
        const bucketDict = {}
        bucketConents.forEach(doc => {
          bucketDict[doc._id] = doc
        })

        // all doc ids in the query
        for (const id of loadOp[bucketKey]) {
          if (bucketDict[id]) docs.push(bucketDict[id])
          else {
            partialFulfillment = true
            break
          }
        }

        // break out early to avoid extra work
        if (partialFulfillment) break
      }

      // partial fulfillment is worthless, reload entire query from DB
      if (partialFulfillment) return loadFromDB()

      this.cache.set(qK, loadOp)
      log(`🔥🧙 Found cached superset! Using query '${match}'`)

      return docs
    }

    const [page, size] = opts.pg || [null, null]
    const low = page && size ? (page - 1) * size : null; const high = page && size ? low + size : null
    const qK = queryKey(this.activeDb, this.activeCollection, query, [low, high])

    const keys = await promisify(this.cache.keys)() // ask cache for all keys
    const strQ = JSON.stringify(query)
    let match; let matchDiff = [Infinity, Infinity]
    let wideMatch, wideMatchDiff

    // determine best match (superset), if it exists
    if (keys) {
      // absolute worst case O(2^(24-9)) = O(32768 iterations)
      for (const key of keys) {
        if (key === qK) {
          match = key
          break
        }

        // match to subset
        const [kDb, kColl, kQ, kR] = key.split('::')

        if (!kColl || !kQ) continue // is not a query key

        // entire set was cached previous, we can get a subset from this easily
        if (kDb === this.activeDb && kColl === this.activeCollection && kQ === strQ && !kR) {
          wideMatch = key
          wideMatchDiff = [low, high]
        }

        const [kLow, kHigh] = kR.split('-')
        if (
          kDb === this.activeDb &&
          kColl === (collectionName || this.activeCollection) && kQ === strQ &&
          low >= kLow &&
          high <= kHigh &&
          (low - kLow < matchDiff[0] && kHigh - high < matchDiff[1])
        ) {
          match = key
          matchDiff = [(low - kLow), (kHigh - high)]
        }
      }

      if (!match && wideMatch) {
        match = wideMatch
        matchDiff = wideMatchDiff
      }
    }

    // no match found; read-through to DB.
    if (!match) return loadFromDB()

    // match found; load it from the cache!
    if (match === qK) return loadFromCache()

    // query not in cache, but a valid subset is!
    if (match && match !== qK) return loadSubsetFromCache()
  }
}

module.exports = FireFerretClient
