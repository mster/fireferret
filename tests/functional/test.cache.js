'use strict'

/* eslint-env jest */

/*
  Functional Testing:
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
  ferret.cache.setClient(redis)
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

describe('get/set documents', function () {
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
    const actualDocs = await cache.getDocuments(queryList)
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
    const actualDocs = await cache.getDocuments(queryList, { hydrate: true })
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
    const queryList = deepClone(docs).map((e) => e._id)

    /* get docs */
    const expected = JSON.parse(JSON.stringify(docs))
    const source = await cache.getDocuments(queryList, { stream: true })
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
