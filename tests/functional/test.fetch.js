'use strict'

/* eslint-env jest */

/*
  Functional Testing:
  FireFerret's Fetch functionality
*/

const { PassThrough } = require('stream')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { createClient } = require('redis-mock')
const FireFerret = require('../../lib/client')

/* using default docs scheme from https://www.npmjs.com/package/mockuments */
const printer = require('mockuments')
const deepClone = require('clone-deep')

let ferret
let mongoServer
let redis
let docs
let ids
const collections = {}

beforeAll(async (done) => {
  jest.setTimeout(120000)

  collections.one = { content: printer(1000), name: 'one', ids: null }
  collections.two = { content: printer(1000), name: 'two', ids: null }

  redis = createClient()
  mongoServer = new MongoMemoryServer()
  const uri = await mongoServer.getConnectionString()

  const opts = {
    mongo: { uri, collectionName: collections.one.name },
    redis: {}
  }
  ferret = new FireFerret(opts)
  ferret.cache.setClient(redis)
  await ferret.connect()

  const mongo = ferret.mongo.getClient()
  const { insertedIds: batchOneIds } = await mongo
    .db()
    .collection(collections.one.name)
    .insertMany(collections.one.content)
  const { insertedIds: batchTwoIds } = await mongo
    .db()
    .collection(collections.two.name)
    .insertMany(collections.two.content)
  collections.one.ids = Object.values(batchOneIds)
  collections.two.ids = Object.values(batchTwoIds)

  done()
})

afterAll(async (done) => {
  await ferret.close()
  await mongoServer.stop()
  redis.quit()
  done()
})

describe('fetch', function () {
  it('should return hydrated documents using the default query', async function (done) {
    const query = undefined
    const queryOptions = { hydrate: true }

    const expected = deepClone(collections.one.content)

    const firstRequest = await ferret.fetch(query, queryOptions)
    expect(firstRequest.length).toEqual(expected.length)
    expect(firstRequest).toEqual(expected)

    const secondRequest = await ferret.fetch(query, queryOptions)
    expect(secondRequest.length).toEqual(expected.length)
    expect(secondRequest).toEqual(expected)

    done()
  })

  it('should return documents without hydrating', async function (done) {
    const query = undefined
    const queryOptions = undefined

    /* first request cache-misses; thus the return is already hydrated from Mongo */
    const expectedFirst = deepClone(collections.one.content)
    const expectedSecond = JSON.parse(JSON.stringify(collections.one.content))

    const firstRequest = await ferret.fetch(query, queryOptions)
    expect(firstRequest).toEqual(expectedFirst)
    const secondRequest = await ferret.fetch(query, queryOptions)
    expect(secondRequest).toEqual(expectedSecond)

    done()
  })

  it('should return hydrated documents that match a query', async function (done) {
    const query = { 'contact.onEarth': true }
    const queryOptions = { hydrate: true }

    const expected = deepClone(collections.one.content).filter(
      (v) => v.contact.onEarth === true
    )

    const firstRequest = await ferret.fetch(query, queryOptions)
    expect(firstRequest).toEqual(expected)
    const secondRequest = await ferret.fetch(query, queryOptions)
    expect(secondRequest).toEqual(expected)

    done()
  })

  it('should obey pagination rules with size of 1', async function (done) {
    const query = {}
    const queryOptions = { hydrate: true, pagination: { page: 1, size: 1 } }

    const expected = deepClone(collections.one.content).slice(0, 1)

    const firstRequest = await ferret.fetch(query, queryOptions)
    expect(expected.length).toEqual(firstRequest.length)
    expect(firstRequest).toEqual(expected)
    const secondRequest = await ferret.fetch(query, queryOptions)
    expect(expected.length).toEqual(secondRequest.length)
    expect(secondRequest).toEqual(expected)

    done()
  })

  it('should obey pagination rules', async function (done) {
    const query = {}
    const queryOptions = {
      hydrate: true,
      pagination: {
        page: 1,
        size: Math.floor(collections.one.content.length / 2)
      }
    }

    const expected = deepClone(collections.one.content).slice(
      0,
      Math.floor(collections.one.content.length / 2)
    )

    const firstRequest = await ferret.fetch(query, queryOptions)
    expect(expected.length).toEqual(firstRequest.length)
    expect(firstRequest).toEqual(expected)
    const secondRequest = await ferret.fetch(query, queryOptions)
    expect(expected.length).toEqual(secondRequest.length)
    expect(secondRequest).toEqual(expected)

    done()
  })

  it('should return a stream when using the queryOptions.stream', async function (done) {
    const query = {}
    const queryOptions = { stream: true }

    const expected = JSON.parse(JSON.stringify(collections.one.content))

    const stream = await ferret.fetch(query, queryOptions)
    expect(stream.constructor).toBe(PassThrough)

    let chunks = ''
    stream.on('data', (chunk) => (chunks += chunk))
    stream.on('end', () => {
      const actual = JSON.parse(chunks)
      expect(actual).toEqual(expected)

      done()
    })
  })

  it('should return a stream that obeys pagination when using the queryOptions.stream', async function (done) {
    const query = {}
    const queryOptions = { stream: true, pagination: { page: 1, size: 5 } }

    const expected = JSON.parse(JSON.stringify(collections.one.content)).slice(
      0,
      5
    )

    const stream = await ferret.fetch(query, queryOptions)
    expect(stream.constructor).toBe(PassThrough)

    let chunks = ''
    stream.on('data', (chunk) => (chunks += chunk))
    stream.on('end', () => {
      const actual = JSON.parse(chunks)
      expect(actual).toEqual(expected)

      done()
    })
  })

  it('should return a stream from the specified collection.', async function (done) {
    const query = {}
    const queryOptions = { stream: true }
    const collectionName = collections.two.name

    const expected = JSON.parse(JSON.stringify(collections.two.content))

    const stream = await ferret.fetch(query, queryOptions, collectionName)
    expect(stream.constructor).toBe(PassThrough)

    let chunks = ''
    stream.on('data', (chunk) => (chunks += chunk))
    stream.on('end', () => {
      const actual = JSON.parse(chunks)
      expect(actual).toEqual(expected)

      done()
    })
  })

  it('should return an array of documents from the specified collection.', async function (done) {
    const query = {}
    const queryOptions = {}
    const collectionName = collections.two.name

    const expected = deepClone(collections.two.content)
    const actual = await ferret.fetch(
      query,
      queryOptions,
      collections.two.name
    )
    expect(actual.length).toEqual(expected.length)
    expect(actual).toEqual(expected)
    done()
  })
})

describe('fetchOne', function () {
  it('should return the first hydrated document that matches the query', async function (done) {
    const query = {}
    const queryOptions = { hydrate: true }

    const expected = deepClone(collections.one.content)[0]

    const firstRequest = await ferret.fetchOne(query, queryOptions)
    expect(firstRequest).toEqual(expected)
    const secondRequest = await ferret.fetchOne(query, queryOptions)
    expect(secondRequest).toEqual(expected)

    done()
  })

  it('should return the first document that matches the query', async function (done) {
    const query = {}
    const queryOptions = undefined

    const expected = JSON.parse(JSON.stringify(collections.one.content))[0]

    await ferret.fetchOne(query, queryOptions) /* prime cache */
    const firstRequest = await ferret.fetchOne(query, queryOptions)
    expect(firstRequest).toEqual(expected)
    const secondRequest = await ferret.fetchOne(query, queryOptions)
    expect(secondRequest).toEqual(expected)

    done()
  })

  it('should return the first document from a specified collection', async function (done) {
    const query = {}
    const queryOptions = { hydrate: true }
    const collectionName = collections.two.name

    const expected = deepClone(collections.two.content)[0]

    const firstRequest = await ferret.fetchOne(
      query,
      queryOptions,
      collectionName
    )
    expect(firstRequest).toEqual(expected)
    const secondRequest = await ferret.fetchOne(
      query,
      queryOptions,
      collectionName
    )
    expect(secondRequest).toEqual(expected)

    done()
  })
})

describe('fetchById', function () {
  it('should return a hydrated document with matching _id', async function (done) {
    const id = collections.one.ids[0]
    const queryOptions = { hydrate: true }

    /* gotta add le _id */
    const expected = { ...deepClone(collections.one.content)[0], _id: id }

    const firstRequest = await ferret.fetchById(id, queryOptions)
    expect(firstRequest).toEqual(expected)
    const secondRequest = await ferret.fetchOne(id, queryOptions)
    expect(secondRequest).toEqual(expected)

    done()
  })

  it('should return a document with matching _id', async function (done) {
    const id = collections.one.ids[0]
    const queryOptions = undefined

    /* gotta add le _id */
    const expected = {
      ...JSON.parse(JSON.stringify(collections.one.content))[0],
      _id: id.toHexString()
    }

    const firstRequest = await ferret.fetchById(id, queryOptions)
    expect(firstRequest).toEqual(expected)
    const secondRequest = await ferret.fetchById(id, queryOptions)
    expect(secondRequest).toEqual(expected)

    done()
  })

  it('should return a document from a specified collection.', async function (done) {
    const id = collections.two.ids[0]
    const queryOptions = undefined
    const collectionName = collections.two.name

    /* gotta add le _id */
    const expected = {
      ...JSON.parse(JSON.stringify(collections.two.content))[0],
      _id: id.toHexString()
    }

    const firstRequest = await ferret.fetchById(
      id,
      queryOptions,
      collectionName
    )
    expect(firstRequest).toEqual(expected)
    const secondRequest = await ferret.fetchById(
      id,
      queryOptions,
      collectionName
    )
    expect(secondRequest).toEqual(expected)

    done()
  })
})
