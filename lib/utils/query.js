'use strict'

const { FFError } = require('./error')

module.exports.queryMatch = function (query, ref, options) {
  if (!options) options = {}

  if (!query) {
    throw new FFError(
      'InvalidArguments',
      'query is a required parameter',
      'queryMatch',
      { query }
    )
  }

  if (!ref) {
    throw new FFError(
      'InvalidArguments',
      'ref is a required parameter',
      'queryMatch',
      { ref }
    )
  }

  const { mode } = options
  if (!mode) {
    throw new FFError(
      'InvalidOptions',
      'options.mode is a required parameter',
      'queryMatch',
      { options }
    )
  }

  if (mode === 'WIDE') {
  }
}
