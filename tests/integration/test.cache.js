'use strict'

/* eslint-env jest */

/*
  Integration Testing:
  FireFerret's Cache (Redis Wrapper)
*/

const { PassThrough } = require('stream')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { ObjectID } = require('mongodb')
const { createClient } = require('redis-mock')
const FireFerret = require('../../lib/client')
const { QueryKey } = require('../../lib/key')

/* using default docs scheme from https://www.npmjs.com/package/mockuments */
const printer = require('mockuments')
const deepClone = require('clone-deep')

let ferret
let mongoServer
let redis
let cache
let docs

beforeAll(async (done) => {
  jest.setTimeout(120000)

  redis = createClient()
  mongoServer = new MongoMemoryServer()
  const uri = await mongoServer.getConnectionString()

  const opts = {
    mongo: { uri, collectionName: 'test' },
    redis: {}
  }
  ferret = new FireFerret(opts)
  ferret.cache._setClient(redis)
  await ferret.connect()

  docs = printer(20)
  docs = docs.map((e) => {
    return { ...e, _id: new ObjectID() }
  })

  cache = ferret.cache

  done()
})

afterAll(async (done) => {
  await ferret.close()
  await mongoServer.stop()
  redis.quit()
  done()
})

describe('getDocuments/setDocuments', function () {
  it('should cache a QueryList as well as the corresponding documents.', async function (done) {
    const queryKey = new QueryKey(
      ferret.mongo.dbName,
      ferret.mongo.collectionName
    )
    const queryList = deepClone(docs).map((e) => e._id)

    /* set */
    const payload = deepClone(docs)
    await cache.setDocuments(queryKey, docs)
    expect(payload).toEqual(docs)

    /* get docs */
    const expectedDocs = JSON.parse(JSON.stringify(docs))
    const actualDocs = await cache.getDocuments(queryList, queryKey)
    expect(actualDocs).toEqual(expectedDocs)

    /* get queryList */
    const expectedQueryList = deepClone(queryList).map((e) => e.toHexString())
    const expectedMatchType = null
    const {
      queryList: actualQueryList,
      matchType: actualMatchType
    } = await cache.getQueryList(queryKey)
    expect(actualQueryList).toEqual(expectedQueryList)
    expect(actualMatchType).toEqual(expectedMatchType)

    done()
  })

  it('should hydrate cached documents when using options.hydrate', async function (done) {
    const queryKey = new QueryKey(
      ferret.mongo.dbName,
      ferret.mongo.collectionName
    )
    const queryList = deepClone(docs).map((e) => e._id)

    /* get docs */
    const expectedDocs = deepClone(docs)
    const actualDocs = await cache.getDocuments(queryList, queryKey, {
      hydrate: true
    })
    expect(actualDocs).toEqual(expectedDocs)

    /* get queryList */
    const expectedQueryList = deepClone(queryList).map((e) => e.toHexString())
    const expectedMatchType = null
    const {
      queryList: actualQueryList,
      matchType: actualMatchType
    } = await cache.getQueryList(queryKey)
    expect(actualQueryList).toEqual(expectedQueryList)
    expect(actualMatchType).toEqual(expectedMatchType)

    done()
  })

  it('should return a stream when using options.stream', async function (done) {
    const queryKey = new QueryKey(
      ferret.mongo.dbName,
      ferret.mongo.collectionName
    )
    const queryList = deepClone(docs).map((e) => e._id)

    /* get docs */
    const expected = JSON.parse(JSON.stringify(docs))
    const source = await cache.getDocuments(queryList, queryKey, {
      stream: true
    })
    expect(source.constructor).toBe(PassThrough)

    let chunks = ''
    source.on('data', (chunk) => (chunks += chunk))
    source.on('end', () => {
      const actual = JSON.parse(chunks)
      expect(actual).toEqual(expected)
      done()
    })
  })
})

describe('getQueryHash/setQueryHash', function () {
  it('should set then get a key/value pair in the given hash.', async function (done) {
    const queryKey = new QueryKey(
      ferret.mongo.dbName,
      ferret.mongo.collectionName
    )

    const expected = deepClone(docs)[0]._id.toHexString()

    await cache.setQueryHash(
      queryKey.oneKey(),
      queryKey.queryString(),
      expected
    )

    const actual = await cache.getQueryHash(
      queryKey.oneKey(),
      queryKey.queryString()
    )
    expect(actual).toEqual(expected)
    done()
  })
})
