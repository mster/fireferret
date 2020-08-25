'use strict'

/* eslint-env jest */

const { Bucket, makeBucket, hashFunction } = require('../../lib/bucket')
const { ObjectID } = require('mongodb')

describe('Bucket', () => {
  const dock = {
    _id: {
      toHexString: function () {
        return 'hexstring'
      }
    },
    key: 'value'
  }

  test('makeBucket', () => {
    const actual = makeBucket('123456', [])
    const expected = new Bucket('123456', [])

    expect(actual).toEqual(expected)
  })

  test('makeBucket with element', () => {
    const bucket = makeBucket('8675309', [dock])

    const actual = bucket._
    const expected = ['hexstring', '{"_id":{},"key":"value"}']

    expect(actual).toEqual(expected)
  })

  test('makeBucket with elements', () => {
    const bucket = makeBucket('8675309', [dock, dock])

    const actual = bucket._
    const expected = [
      'hexstring',
      '{"_id":{},"key":"value"}',
      'hexstring',
      '{"_id":{},"key":"value"}'
    ]

    expect(actual).toEqual(expected)
  })
})

describe('HashFunction', () => {
  test('using Strings', () => {
    const mockumentID = '776f7775666f756e646d6521'

    const actual = hashFunction(mockumentID)
    const expected = '14002'

    expect(actual).toEqual(expected)
  })

  test('using Strings', () => {
    const mockumentID = '74616b756d69746f66755844'

    const actual = hashFunction(mockumentID)
    const expected = '15020'

    expect(actual).toEqual(expected)
  })

  test('using ObjectID', () => {
    const mockumentID = new ObjectID(3301)

    const actual = hashFunction(mockumentID)

    /* for readability */
    const counterBytes = mockumentID.toHexString().slice(18)
    const counterBytesDecimal = parseInt(counterBytes, 16)
    const bucketHashInt = Math.floor(counterBytesDecimal / 512)
    const expected = bucketHashInt.toString()

    expect(actual).toEqual(expected)
  })

  test('using ObjectID', () => {
    const mockumentID = new ObjectID(1033)

    const actual = hashFunction(mockumentID)

    /* for readability */
    const counterBytes = mockumentID.toHexString().slice(18)
    const counterBytesDecimal = parseInt(counterBytes, 16)
    const bucketHashInt = Math.floor(counterBytesDecimal / 512)
    const expected = bucketHashInt.toString()

    expect(actual).toEqual(expected)
  })

  test('throws on null', () => {
    expect(() => {
      hashFunction(null)
    }).toThrow()
  })

  test('throws on Array', () => {
    expect(() => {
      hashFunction(new Array(10))
    }).toThrow()
  })

  test('throws on Object', () => {
    expect(() => {
      hashFunction({ rada: 'Rada-rada' })
    }).toThrow()
  })
})
