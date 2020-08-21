'use strict'

const { FFError } = require('./error')

const debug = require('util').debuglog('fireferret::utils')

const SYMBOLS = {
  EMPTY_QUERY: Symbol('EMPTY_QUERY'),
  EMPTY_OBJ: Symbol('EMPTY_OBJECT'),
  NULL_DOC: Symbol('NULL_DOC'),
  CACHE_HIT: Symbol('CACHE_HIT'),
  CACHE_MISS: Symbol('CACHE_MISS')
}

const SPECIAL_CHARS = {
  QUERY_DELIMITER: '=',
  BUCKET_DELIMITER: '~'
}

function keyify (dbName, collectionName, query = {}, queryOptions) {
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

    /*
      Using query options -- possible subquery
    */
    if (queryOptions && Object.keys(queryOptions).length !== 0) {
      const options = {}

      const pageOptions = validatePaginationOpts(queryOptions)

      if (pageOptions) {
        options.start = pageOptions.start
        options.end = pageOptions.end
      }

      const stringFilteredOpts = JSON.stringify(options)
      const qOpKey = Buffer.from(stringFilteredOpts).toString('utf-8')

      return `ff:${dbName}::${collectionName}:${qKey}::${qOpKey}`
    }

    /*
      No query options -- possible superquery
    */
    return `ff:${dbName}::${collectionName}:${qKey}`
  } catch (err) {
    throw new FFError('InternalError', 'Keyify failed', 'query::keyify', err)
  }
}

function getQueryVerdict (idMap) {
  return !idMap || idMap.length === 0
    ? SYMBOLS.CACHE_MISS
    : idMap && idMap[0] === SYMBOLS.EMPTY_QUERY.description
      ? SYMBOLS.EMPTY_QUERY
      : SYMBOLS.CACHE_HIT
}

function validatePaginationOpts (options = {}) {
  let { page, size } = options.pagination ? options.pagination : {}

  if (page && size) {
    if (isNaN(page) || isNaN(size)) {
      throw new FFError(
        'InvalidOptions',
        'Pagination requires page and size to be numbers',
        'page::validatePaginationOpts',
        options.pagination
      )
    }

    page = Number(page)
    size = Number(size)

    if (page === 0) {
      throw new FFError(
        'InvalidOptions',
        'page is zero -- paginagion begins with page = 1',
        'page::validatePaginationOpts',
        options.pagination
      )
    }

    const start = (page - 1) * size
    const end = page * size

    return { page, size, start, end }
  }

  return 0
}

function filterAvailableWideMatch (cachedQueries, pageOptions) {
  if (!cachedQueries || cachedQueries.constructor.name !== 'Array') {
    throw new FFError(
      'InvalidArguments',
      'cachedQueries is a required parameter and must be of type Array',
      'page::filterAvailableWideMatch',
      { cachedQueries }
    )
  }

  /* sort by shortest key */
  const sorted = cachedQueries.sort((a, b) => {
    return a.length - b.length
  })

  /* push non-paginated query if it exists */
  if (sorted[0].split(/::/).length === 2) sorted.push(sorted.shift())

  for (const query of sorted) {
    const split = query.split(/::/)

    /* grab the params from the query, if they exist */
    const queryParams = split[2]
      ? split[2].length > 0
        ? split[2]
        : null
      : null

    /* prefer to use smallest superset i.e. another paginated query */
    if (queryParams) {
      const { start, end } = JSON.parse(queryParams)

      /* goldilocks zone; not too hot, not too cold */
      if (start <= pageOptions.start && end >= pageOptions.end) {
        const _start = pageOptions.start - start
        const _end = _start + (pageOptions.end - pageOptions.start)

        const ret = {
          targetQuery: query,
          rangeOptions: {
            start: _start,
            end: _end
          }
        }

        debug('goldilocks zone match', _start, _end, query)
        return ret
      }
    }

    /* mass look-up matched */
    if (!queryParams) {
      const ret = {
        targetQuery: query,
        rangeOptions: pageOptions
      }
      return ret
    }
  }

  /*  failed to match any existing query */
  return {}
}

module.exports = {
  SYMBOLS,
  SPECIAL_CHARS,
  keyify,
  getQueryVerdict,
  validatePaginationOpts,
  filterAvailableWideMatch
}
