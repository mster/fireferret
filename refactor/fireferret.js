'use strict'

const MongoDriver = require('./mongod')
const queryKey = require('./util/queryKey')
const hash = require('./util/hash')
const cacheManager = require('cache-manager')
const { promisify } = require('util')

const log = require('util').debuglog('ff::client')

class FireFerretClient {
    constructor (opts={}) {
        this.mongod = new MongoDriver(opts.uri, { coll: opts.coll })
        this.activeDb = null;
        this.activeCollection = opts.coll || opts.collection || null;

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
        const [dbName, collName] = await this.mongod.connect();
        this.activeDb = dbName;
        this.activeCollection = collName

        const collText = this.activeCollection ? ` with collection=${this.activeCollection}` : ''
        log(`🔥🐈 FireFerret connected to db=${this.activeDb}${collText}`)

        return 'ok';
    }

    async close () {
        await this.mongod.close();

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


        return 'ok';
    }

    async find (query, opts={}, collectionName=null) {
        // miss
        // fetch docs
        // hmap docs
        // set hash <-> array of objects
        // qk <-> list of hashes containing elements


        const [page, size] = opts.pg || []
        const low = (page - 1) * size, high = low + size;
        const qK = queryKey(this.activeDb, this.activeCollection, query, [low, high])

        // ask cache for all keys
        const keys = await promisify(this.cache.keys)()
        const strQ = JSON.stringify(query)
        let match, matchDiff = Infinity;

        // determine best match (superset), if it exists
        if (keys) {
            for(let key of keys) {
                const [kDb, kColl, kQ, kR] = key.split(':')
    
                if (!kColl || !kQ) continue // is not a query key
    
                const [kLow, kHigh] = kR.split('-')
                if (
                    kDb === this.activeDb &&
                    kColl === (collectionName ? collectionName : this.activeCollection) &&
                    kQ === strQ &&
                    low >= kLow &&
                    high <= kHigh &&
                    ((low - kLow) + (kHigh - high) < matchDiff)
                ) {
                    match = key;
                    matchDiff = (low - kLow) + (kHigh - high)
                }
            }
        }

        console.log('match', match)

        // no match found, read-through
        if (!match) {
            log(`🔥❌ Cache miss!`)

            const docs = await this.mongod.find(query, { skip: low, limit: size})

            // O(# of docs)
            const hmap = {}
            docs.forEach(doc => {
                const id = doc._id.toHexString();
                const hashId = hash(id);

                if (hmap[hashId]) hmap[hashId].push(doc)
                else hmap[hashId] = [doc]
            })

            // O(# of docs / 512)
            const hashes = Object.keys(hmap)
            hashes.forEach(key => {
                this.cache.set(key, hmap[key]) // no need to wait
            })

            this.cache.set(qK, hashes) // no need to wait

            return docs
        }

        // match found
        if (match === qK) {
            log(`🔥✅ Cache hit!`)

            const buckets = await this.cache.get(match);
            const docs = []

            // O(# of docs / 512)
            for(let key of buckets) {
                docs.push(... await this.cache.get(key))
            }

            return docs
        }

        if (match && match !== qK) {
            log(`🔥🧙‍♂️ Valid match found!`)
        }

        return []
    }
}

module.exports = FireFerretClient