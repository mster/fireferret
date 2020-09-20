'use strict'

/* eslint-env jest */
const { ObjectID } = require('mongodb')
const {
  validatePaginationOpts,
  filterAvailableWideMatch,
  fastReverse,
  hydrate
} = require('../../lib/utils')

describe('Utils', () => {
  test('validatePaginationOpts should return 0 when passed options is null', () => {
    const actual = validatePaginationOpts(null)
    const expected = null

    expect(actual).toEqual(expected)
  })

  test('validatePaginationOpts should return 0 when non-pagination options are passed', () => {
    const actual = validatePaginationOpts({ foo: 'bar', baz: 'qux' })
    const expected = null

    expect(actual).toEqual(expected)
  })

  test('validatePaginationOpts should return 0 when empty pagination options are passed', () => {
    const actual = validatePaginationOpts({ pagination: {} })
    const expected = null

    expect(actual).toEqual(expected)
  })

  test('validatePaginationOpts should return 0 when only pagination page option is passed', () => {
    const actual = validatePaginationOpts({ pagination: { page: 1 } })
    const expected = null

    expect(actual).toEqual(expected)
  })

  test('validatePaginationOpts should return 0 when only pagination size option is passed', () => {
    const actual = validatePaginationOpts({ pagination: { size: 1 } })
    const expected = null

    expect(actual).toEqual(expected)
  })

  test('validatePaginationOpts should throw when pagination options are NaN', () => {
    expect(() => {
      validatePaginationOpts({
        pagination: { page: 'God', size: 'ofHellfire' }
      })
    }).toThrow()

    expect(() => {
      validatePaginationOpts({
        pagination: { page: 'lavender', size: 1265 }
      })
    }).toThrow()

    expect(() => {
      validatePaginationOpts({
        pagination: { page: 666, size: 'badbadnotgood' }
      })
    }).toThrow()
  })

  test('filterAvailableWideMatch should golidlocks match a larger super query', () => {
    const actual = filterAvailableWideMatch(
      ['ns:db::collection:query={}::{"start":0,"end":101}'],
      { start: 0, end: 100 }
    )

    const expected = {
      rangeOptions: { end: 100, start: 0 },
      targetQuery: 'ns:db::collection:query={}::{"start":0,"end":101}'
    }
    expect(actual).toEqual(expected)
  })

  test('filterAvailableWideMatch should golidlocks match a larger super query', () => {
    const actual = filterAvailableWideMatch(
      [
        'ns:db::collection:query={}::{"start":0,"end":101}',
        'ns:db::collection:query={}::{"start":0,"end":1001}'
      ],
      { start: 0, end: 1000 }
    )

    const expected = {
      rangeOptions: { end: 1000, start: 0 },
      targetQuery: 'ns:db::collection:query={}::{"start":0,"end":1001}'
    }
    expect(actual).toEqual(expected)
  })

  test('filterAvailableWideMatch should golidlocks match a larger super query', () => {
    const actual = filterAvailableWideMatch(
      [
        'ns:db::collection:query={}::{"start":0,"end":101}',
        'ns:db::collection:query={}::{"start":100,"end":1001}'
      ],
      { start: 100, end: 201 }
    )

    const expected = {
      rangeOptions: { end: 101, start: 0 },
      targetQuery: 'ns:db::collection:query={}::{"start":100,"end":1001}'
    }
    expect(actual).toEqual(expected)
  })

  test('filterAvailableWideMatch should use a non-paginated query if available', () => {
    const actual = filterAvailableWideMatch(
      [
        'ns:db::collection:query={}::{"start":0,"end":201}',
        'ns:db::collection:query={}'
      ],
      { start: 101, end: 301 }
    )

    const expected = {
      rangeOptions: { end: 301, start: 101 },
      targetQuery: 'ns:db::collection:query={}'
    }
    expect(actual).toEqual(expected)
  })

  test('filterAvailableWideMatch should return if no wide matches are found', () => {
    const actual = filterAvailableWideMatch(
      [
        'ns:db::collection:query={}::{"start":0,"end":201}',
        'ns:db::collection:query={}::{"start":1200,"end":1201}'
      ],
      { start: 300, end: 365 }
    )

    const expected = null
    expect(actual).toEqual(expected)
  })

  test('fastReverse retains parity with native Array.reverse', () => {
    const a = [1, 2, 3, 5, 6, 'a', 'b', 'c', 'd', 'e', 'f', 7]

    const actualA = fastReverse(a)
    const expectedA = a.reverse()

    expect(actualA).toEqual(expectedA)

    const b = []

    const actualB = fastReverse(b)
    const expectedB = b.reverse()

    expect(actualB).toEqual(expectedB)

    expect(() => {
      const c = null
      fastReverse(c)
    }).toThrow()
  })

  test('hydrate should coerce types', () => {
    const expected = {
      date: new Date(),
      _id: new ObjectID()
    }
    const raw = JSON.stringify(expected)

    const acutal = hydrate(raw)
    expect(acutal).toEqual(expected)
  })
})
