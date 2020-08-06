'use strict'

const { FFError } = require('./error')
const debug = require('util').debuglog('fireferret::page')

module.exports.validatePaginationOpts = function (options = {}) {
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

module.exports.filterAvailableWideMatch = function (
  cachedQueries,
  pageOptions
) {
  if (!cachedQueries || cachedQueries.constructor.name !== 'Array') {
    throw new FFError(
      'InvalidArguments',
      'cachedQueries is a required parameter and must be type Array',
      'page::filterAvailableWideMatch',
      { cachedQueries }
    )
  }

  /* sort by smallest key, then reverse it */
  const sorted = cachedQueries[1].sort().reverse()

  for (const query of sorted) {
    const split = query.split(/::/)

    /* prefer to use smallest superset i.e. another paginated query */
    if (split[2] && split[2].length > 0) {
      const { start, end } = JSON.parse(split[2])

      /* goldilocks zone */
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
    if (!split[2]) {
      const ret = {
        targetQuery: query,
        rangeOptions: pageOptions
      }
      return ret
    }
  }

  return {}
}
