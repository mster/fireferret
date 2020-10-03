'use strict'

/* eslint-env jest */

/*
  Functional Testing:
  FireFerret's Fetch functionality
*/

const { createClient } = require('redis-mock')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { FerretError } = require('../../lib/error')
const FireFerret = require('../../lib/client')

let redisClient
let mongoServer
let uri

beforeAll(async (done) => {
  jest.setTimeout(120000)

  mongoServer = new MongoMemoryServer()
  uri = await mongoServer.getConnectionString()

  redisClient = createClient()
  done()
})

afterAll(async (done) => {
  await mongoServer.stop()
  done()
})

describe('client', function () {
  it('should throw when attempting to connect to invalid endpoints.', async function (done) {
    const client = new FireFerret({ mongo: {}, redis: {} })
    await expect(client.connect).rejects.toThrow()
    done()
  })

  it('should throw when attempting to close an inactive connection.', async function (done) {
    const client = new FireFerret({ mongo: {}, redis: {} })
    await expect(client.close).rejects.toThrow()
    done()
  })

  it('should throw when attempting to connect with invalid redis options.', async function (done) {
    const client = new FireFerret({ mongo: { uri }, redis: {} })
    await expect(client.connect).rejects.toThrow()
    done()
  })

  it('should throw when attempting to connect with invalid mongo options.', async function (done) {
    const client = new FireFerret({
      mongo: { uri: 'foobar.com/baz' },
      redis: {}
    })
    client.cache._setClient(redisClient)
    await expect(client.connect).rejects.toThrow()
    done()
  })

  it('should connect.', async function (done) {
    const client = new FireFerret({
      mongo: { uri },
      redis: {}
    })
    client.cache._setClient(redisClient)
    await expect(client.connect).not.toBe(FerretError)
    done()
  })
})
