'use strict'

/* eslint-env jest */

const { FerretError } = require('../../lib/error')

describe('error', function () {
  it('toString should return a string with default values.', function () {
    const error = new FerretError()
    const actual = error.toString()
    const expected = 'FireFerretError: '
    expect(actual).toEqual(expected)
  })

  it('toString should return a string with default values.', function () {
    const error = new FerretError(
      'TestError',
      'msg',
      'test::msg',
      new FerretError()
    )
    const actual = error.toString()
    const expected = 'TestError: msg\ntest::msg\nFireFerretError: '
    expect(actual).toEqual(expected)
  })
})
