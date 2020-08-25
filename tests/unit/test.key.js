'use strict'

/* eslint-env jest */

const { QueryKey } = require('../../lib/key')

const DB_NAME = 'database'
const COLLECTION_NAME = 'collection'
const QUERY = { name: { $in: ['mongoose', 'nw'] } }
const QUERY_OPTIONS = { pagination: { page: 1, size: 1e3 } }

describe('QueryKey', () => {
  test('Instantiating a QueryKey', () => {
    const actual = new QueryKey(DB_NAME, COLLECTION_NAME, QUERY, QUERY_OPTIONS)

    expect(actual.dbName).toEqual(DB_NAME)
    expect(actual.collectionName).toEqual(COLLECTION_NAME)
    expect(actual.query).toEqual(QUERY)
    expect(actual.queryOptions).toEqual(QUERY_OPTIONS)
  })

  test('toString', () => {
    const key = new QueryKey(DB_NAME, COLLECTION_NAME, QUERY, QUERY_OPTIONS)

    const actual = key.toString()
    const expected =
      'ff:database::collection:query={"name":{"$in":["mongoose","nw"]}}::{"start":0,"end":1000}'
    expect(actual).toEqual(expected)
  })

  test('toString memoized', () => {
    const key = new QueryKey(DB_NAME, COLLECTION_NAME, QUERY, QUERY_OPTIONS)

    key.toString()
    key.dbName = 'foo'

    const actual = key.toString()
    const expected =
      'ff:database::collection:query={"name":{"$in":["mongoose","nw"]}}::{"start":0,"end":1000}'
    expect(actual).toEqual(expected)
  })

  test('inspect', () => {
    const key = new QueryKey(DB_NAME, COLLECTION_NAME, QUERY, QUERY_OPTIONS)

    const actual = key.inspect()
    const expected =
      'ff:database::collection:query={"name":{"$in":["mongoose","nw"]}}::{"start":0,"end":1000}'
    expect(actual).toEqual(expected)
  })

  test('baseKey', () => {
    const key = new QueryKey(DB_NAME, COLLECTION_NAME, QUERY, QUERY_OPTIONS)

    const actual = key.baseKey()
    const expected =
      'ff:database::collection:query={"name":{"$in":["mongoose","nw"]}}'
    expect(actual).toEqual(expected)
  })

  test('baseKey memoized', () => {
    const key = new QueryKey(DB_NAME, COLLECTION_NAME, QUERY, QUERY_OPTIONS)

    key.baseKey()
    key.dbName = 'foo'

    const actual = key.baseKey()
    const expected =
      'ff:database::collection:query={"name":{"$in":["mongoose","nw"]}}'
    expect(actual).toEqual(expected)
  })

  test('oneKey', () => {
    const key = new QueryKey(DB_NAME, COLLECTION_NAME, QUERY, QUERY_OPTIONS)

    const actual = key.oneKey()
    const expected = 'ff:database::collection:findOne'
    expect(actual).toEqual(expected)
  })

  test('oneKey memoized', () => {
    const key = new QueryKey(DB_NAME, COLLECTION_NAME, QUERY, QUERY_OPTIONS)

    key.oneKey()
    key.dbName = 'foo'

    const actual = key.oneKey()
    const expected = 'ff:database::collection:findOne'
    expect(actual).toEqual(expected)
  })

  test('queryString', () => {
    const key = new QueryKey(DB_NAME, COLLECTION_NAME, QUERY, QUERY_OPTIONS)

    const actual = key.queryString()
    const expected = '{"name":{"$in":["mongoose","nw"]}}'
    expect(actual).toEqual(expected)
  })

  test('queryString memoized', () => {
    const key = new QueryKey(DB_NAME, COLLECTION_NAME, QUERY, QUERY_OPTIONS)

    key.queryString()
    key.query = { is: { that: { $an: 86 } } }

    const actual = key.queryString()
    const expected = '{"name":{"$in":["mongoose","nw"]}}'
    expect(actual).toEqual(expected)
  })

  test('Regular expressions are encoded', () => {
    const key = new QueryKey(DB_NAME, COLLECTION_NAME, /^.*$/)

    const actualToString = key.toString()
    expect(actualToString).toEqual('ff:database::collection:query="/%5E.*$/"')

    const actualQueryString = key.queryString()
    expect(actualQueryString).toEqual('"/%5E.*$/"')
  })
})
