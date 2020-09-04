'use strict'

const { FFError } = require('./error')
const {
  SPECIAL_CHARS: { QUERY_DELIMITER },
  validatePaginationOpts
} = require('./utils')

/**
 * Creates a new QueryKey instance.
 * @constructor
 * @param {String} dbName - The database to query
 * @param {String} collectionName - The collection to query
 * @param {Object} query - The cursor query object.
 * @param {Object} queryOptions - The query options.
 * @param {String} [ns='ff'] - The namescape to use for keys.
 */
class QueryKey {
  constructor (dbName, collectionName, query, queryOptions, ns = 'ff') {
    this.ns = ns
    this.dbName = dbName
    this.collectionName = collectionName
    this.query = query
    this.queryOptions = queryOptions

    /* INTERNAL -- cache stringifies */
    this._queryString = null
    this._toString = null
    this._baseKey = null
    this._oneKey = null
  }

  /**
   * Generates a QueryKey string without query options
   *
   * @returns {String} The base key string.
   */
  baseKey () {
    if (!this._baseKey) {
      this._baseKey = this.toString(true)
    }

    return this._baseKey
  }

  /**
   * Generates a QueryKey string to be used with individual retrievals.
   *
   * @returns {String} The one key string.
   */
  oneKey () {
    if (!this._oneKey) {
      this._oneKey = `${this.ns}:${this.dbName}::${this.collectionName}:findOne`
    }

    return this._oneKey
  }

  /**
   * Generate a QueryKey string which includes only the query itself.
   *
   * @returns {String} The Query string.
   */
  queryString () {
    if (!this._queryString) {
      this._queryString = JSON.stringify(
        this.query,
        (k, value) => {
          if (value.constructor.name === 'RegExp') {
            /* Redis doesnt like backslashes in keys */
            return encodeURI(value.toString())
          }
          return value
        },
        0
      )
    }

    return this._queryString
  }

  /**
   * Generates a QueryKey string.
   *
   * @param {boolean} [baseKeyOnly=false] - Generate only the base key variant.
   *
   * @returns {String} The QueryKey string.
   */
  toString (baseKeyOnly = false) {
    if (this._toString && !baseKeyOnly) return this._toString

    try {
      const stringQuery = JSON.stringify(
        this.query,
        (k, value) => {
          if (value.constructor.name === 'RegExp') {
            /* Redis doesnt like backslashes in keys */
            return encodeURI(value.toString())
          }
          return value
        },
        0
      )

      /* Full key */
      if (
        !baseKeyOnly &&
        this.queryOptions &&
        Object.keys(this.queryOptions).length !== 0
      ) {
        const options = {}

        const pageOptions = validatePaginationOpts(this.queryOptions)

        if (pageOptions) {
          options.start = pageOptions.start
          options.end = pageOptions.end
        }

        const stringFilteredOpts = JSON.stringify(options)

        const stringKey = `${this.ns}:${this.dbName}::${this.collectionName}:query${QUERY_DELIMITER}${stringQuery}::${stringFilteredOpts}`
        this._toString = stringKey

        return stringKey
      }

      /* Base key */
      const stringKey = `${this.ns}:${this.dbName}::${this.collectionName}:query${QUERY_DELIMITER}${stringQuery}`
      return stringKey
    } catch (err) {
      throw new FFError(
        'InternalError',
        'key toString has failed.' + err,
        'QueryKey::toString',
        err
      )
    }
  }

  inspect () {
    return this.toString()
  }
}

module.exports = { QueryKey }
