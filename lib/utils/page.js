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
      'cachedQueries is a required parameter and must be of type Array',
      'page::filterAvailableWideMatch',
      { cachedQueries }
    )
  }

  /* sort by smallest key, then move any wide queries */
  const sorted = cachedQueries.sort()
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
      const { start, end } = JSON.parse(split[2])

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
