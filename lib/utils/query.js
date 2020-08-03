'use strict'

const { FFError } = require('./error')
const { EMPTY_QUERY, CACHE_MISS, CACHE_HIT } = require('./symbols')

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

module.exports.keyify = function (dbName, collectionName, query, queryOptions) {
  try {
    const stringQuery = JSON.stringify(
      query,
      (k, value) => {
        if (value.constructor.name === 'RegExp') return value.toString()
        return value
      },
      0
    )
    const qKey = Buffer.from(stringQuery).toString('utf-8')

    if (queryOptions && Object.keys(queryOptions).length !== 0) {
      const stringQueryOptions = JSON.stringify(queryOptions)
      const qOpKey = Buffer.from(stringQueryOptions).toString('utf-8')

      return `ff:${dbName}::${collectionName}:${qKey}::${qOpKey}`
    }

    return `ff:${dbName}::${collectionName}:${qKey}`
  } catch (err) {
    throw new FFError('InternalError', 'Keyify failed', 'query::keyify', err)
  }
}

module.exports.getQueryVerdict = function (idMap) {
  return !idMap || idMap.length === 0
    ? CACHE_MISS
    : idMap && idMap[0] === EMPTY_QUERY.description
      ? EMPTY_QUERY
      : CACHE_HIT
}
