'use strict'

/* eslint-env jest */

/*
  Integration Testing:
  FireFerret's MongoDB Wrapper
*/

const { PassThrough } = require('stream')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { createClient } = require('redis-mock')
const FireFerret = require('../../lib/client')
const { QueryKey } = require('../../lib/key')

/* using default docs scheme from https://www.npmjs.com/package/mockuments */
const printer = require('mockuments')
const deepClone = require('clone-deep')

let ferret
let mongoServer
let mongoWrapper
let redis
let docs
let ids

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

  const mongo = ferret.mongo._getClient()
  const { insertedIds } = await mongo
    .db()
    .collection(opts.mongo.collectionName)
    .insertMany(docs)
  ids = insertedIds

  mongoWrapper = ferret.mongo

  done()
})

afterAll(async (done) => {
  await ferret.close()
  await mongoServer.stop()
  redis.quit()
  done()
})

describe('findDocs', function () {
  it('should fetch documents from a database.', async function (done) {
    const queryKey = new QueryKey(
      mongoWrapper.dbName,
      mongoWrapper.collectionName,
      undefined,
      undefined
    )
    const queryOptions = undefined

    const actual = await mongoWrapper.findDocs(queryKey, queryOptions)
    const expected = deepClone(docs)

    expect(actual).not.toBe(undefined)
    expect(actual).toEqual(expected)

    done()
  })

  it('should fetch documents from a database that matches the given query.', async function (done) {
    const queryKey = new QueryKey(
      mongoWrapper.dbName,
      mongoWrapper.collectionName,
      { 'contact.onEarth': true },
      undefined
    )
    const queryOptions = undefined

    const actual = await mongoWrapper.findDocs(queryKey, queryOptions)
    const expected = deepClone(docs).filter((v) => v.contact.onEarth === true)

    expect(actual).not.toBe(undefined)
    expect(actual).toEqual(expected)

    done()
  })

  it('should fetch documents from a database that obey pagination rules.', async function (done) {
    const queryKey = new QueryKey(
      mongoWrapper.dbName,
      mongoWrapper.collectionName,
      undefined,
      undefined
    )
    const queryOptions = { skip: 0, limit: 10 }

    const actual = await mongoWrapper.findDocs(queryKey, queryOptions)
    const expected = deepClone(docs).slice(0, 10)

    expect(actual).not.toBe(undefined)
    expect(actual).toEqual(expected)

    done()
  })

  it('should fetch no documents from a database with an unmatchable query.', async function (done) {
    const queryKey = new QueryKey(
      mongoWrapper.dbName,
      mongoWrapper.collectionName,
      { badQuery: 666 }, // we know this doesn't exist in the sample docs
      undefined
    )
    const queryOptions = undefined

    const actual = await mongoWrapper.findDocs(queryKey, queryOptions)
    const expected = []

    expect(actual).not.toBe(undefined)
    expect(actual).toEqual(expected)

    done()
  })
})

describe('findDocsStream', function () {
  it('should fetch a stream of documents from a database.', async function (done) {
    const queryKey = new QueryKey(
      mongoWrapper.dbName,
      mongoWrapper.collectionName,
      undefined,
      undefined
    )
    const queryOptions = undefined

    const expected = JSON.parse(JSON.stringify(docs))
    const expectedCapture = deepClone(docs)

    const { sink: source, capture } = await mongoWrapper.findDocsStream(
      queryKey,
      queryOptions
    )

    expect(source.constructor).toBe(PassThrough)
    expect(capture.constructor).toBe(Array)

    let chunks = ''
    source.on('data', (chunk) => (chunks += chunk))
    source.on('end', () => {
      const actual = JSON.parse(chunks)

      expect(actual).toEqual(expected)
      expect(capture).toEqual(expectedCapture)

      done()
    })
  })

  it('should fetch a stream without documents when using an unmatchable query.', async function (done) {
    const queryKey = new QueryKey(
      mongoWrapper.dbName,
      mongoWrapper.collectionName,
      { badQuery: 666 }, // we know this doesn't exist in the sample docs
      undefined
    )
    const queryOptions = undefined

    const expected = []
    const expectedCapture = []

    const { sink: source, capture } = await mongoWrapper.findDocsStream(
      queryKey,
      queryOptions
    )

    expect(source.constructor).toBe(PassThrough)
    expect(capture.constructor).toBe(Array)

    let chunks = ''
    source.on('data', (chunk) => (chunks += chunk))
    source.on('end', () => {
      const actual = JSON.parse(chunks)

      expect(actual).toEqual(expected)
      expect(capture).toEqual(expectedCapture)

      done()
    })
  })
})

describe('findOne', function () {
  it('should fetch documents from a database.', async function (done) {
    const queryKey = new QueryKey(
      mongoWrapper.dbName,
      mongoWrapper.collectionName,
      undefined,
      undefined
    )

    const actual = await mongoWrapper.findOne(queryKey)
    const expected = deepClone(docs)[0]

    expect(actual).not.toBe(undefined)
    expect(actual).toEqual(expected)

    done()
  })

  it('should fetch documents from a database.', async function (done) {
    const queryKey = new QueryKey(
      mongoWrapper.dbName,
      mongoWrapper.collectionName,
      { 'contact.onEarth': true },
      undefined
    )

    const actual = await mongoWrapper.findOne(queryKey)
    const expected = deepClone(docs).filter(
      (v) => v.contact.onEarth === true
    )[0]

    expect(actual).not.toBe(undefined)
    expect(actual).toEqual(expected)

    done()
  })
})
