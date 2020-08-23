'use strict'

const { FFError } = require('./error')
const {
  SPECIAL_CHARS: { QUERY_DELIMITER },
  validatePaginationOpts
} = require('./utils')

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

  baseKey () {
    if (!this._baseKey) {
      this._baseKey = this.toString(true)
    }

    return this._baseKey
  }

  oneKey () {
    if (!this._oneKey) {
      this._oneKey = `${this.ns}:${this.dbName}::${this.collectionName}:findOne`
    }

    return this._oneKey
  }

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
