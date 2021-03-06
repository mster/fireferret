'use strict'

/**
 * @namespace Utils
 */

const { FerretError } = require('./error')
const { ObjectID } = require('mongodb')

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

/**
 * Pagination Options
 *
 * @typedef PaginationOptions
 * @property {Number} page - The page number.
 * @property {Number} size - The page size.
 * @property {Number} start - The starting index.
 * @property {Number} end - The ending index (exclusive)
 */
/**
 * Validates and reformats pagination options.
 * @memberof Utils
 *
 * @param {Object} options - The query options.
 *
 * @returns {PaginationOptions|null}
 */
function validatePaginationOpts (options) {
  if (!options) options = {}

  let { page, size } = options.pagination ? options.pagination : {}

  if (page && size) {
    if (isNaN(page) || isNaN(size)) {
      throw new FerretError(
        'InvalidOptions',
        'Pagination requires page and size to be numbers',
        'page::validatePaginationOpts',
        options.pagination
      )
    }

    page = Number(page)
    size = Number(size)

    if (page === 0) {
      throw new FerretError(
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

  return null
}

/**
 * Wide-Match strategy results.
 *
 * @typedef WideMatch
 * @property {String} targetQuery - A super-query that contains the requested query.
 * @property {Object} rangeOptions
 * @property {Number} rangeOptions.start - The starting index of the requested query's data (inclusive).
 * @property {Number} rangeOptions.end -  The starting index of the requested query's data (exclusive).
 */
/**
 * Determines if any perviously cached queries can be used to fulfill the current query.
 * @memberof Utils
 *
 * @param {Array} cachedQueries - A list of previously cached queries.
 * @param {PaginationOptions} pageOptions - Pagination options for the current query, if any.
 *
 * @returns {WideMatch|null}
 */
function filterAvailableWideMatch (cachedQueries, pageOptions) {
  if (!cachedQueries || cachedQueries.constructor.name !== 'Array') {
    return null
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

        debug('WideMatch - Goldilocks criteria met:', ret)
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
  return null
}

/* @AamuLumi https://github.com/kb-dev/sanic.js */
function fastReverse (array) {
  let temp = null
  const length = array.length

  for (let i = 0, max = Math.floor(length / 2); i < max; i++) {
    temp = array[i]
    array[i] = array[length - i - 1]
    array[length - i - 1] = temp
  }

  return array
}

/**
 * When parsing, coerce types where applicable.
 * @param {Object} document - The document to hydrate.
 *
 * @returns {Object} The hydrated document.
 */
function hydrate (document) {
  const dateFormat = /^(.)(\d*)-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/
  try {
    return JSON.parse(document, (key, value) => {
      if (key === '_id') {
        return ObjectID(value)
      } else if (typeof value === 'string' && dateFormat.test(value)) {
        return new Date(value)
      } else {
        return value
      }
    })
  } catch (err) {
    throw new FerretError(
      'SyntaxError',
      'Unable to hydrate documents. Received unexpected JSON input.',
      'utils::hydrate',
      err
    )
  }
}

module.exports = {
  SYMBOLS,
  SPECIAL_CHARS,
  validatePaginationOpts,
  filterAvailableWideMatch,
  fastReverse,
  hydrate
}
