'use strict'

/* eslint-env jest */

const { filterOpts } = require('../../lib/options')

describe('Options', () => {
  test('filterOpts should return an empty object if options are not in the filter set', () => {
    const actual = filterOpts(
      { foo: 'bar', baz: 'qux' },
      { uri: 'dead:://lay.in?pools=of&maroon=below', dbName: 'Jeremy' }
    )
    const expected = {}

    expect(actual).toEqual(expected)
  })

  test('filterOpts should return object which contains filtered options', () => {
    const actual = filterOpts(
      { king: 'Jeremy', wicked: true },
      { king: 'NotJeremy', wicked: false }
    )
    const expected = { king: 'Jeremy', wicked: true }

    expect(actual).toEqual(expected)
  })

  test('filterOpts with null options returns and empty object', () => {
    const actual = filterOpts(null, { spoke: true, inClass: Date.now() })
    const expected = {}

    expect(actual).toEqual(expected)
  })

  test('filterOpts with null arguments returns and empty object', () => {
    const actual = filterOpts()
    const expected = {}

    expect(actual).toEqual(expected)
  })
})
