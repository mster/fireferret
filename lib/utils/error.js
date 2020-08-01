'use strict'

class FFError extends Error {
  constructor (name, message, scope, error) {
    super(message)
    this.name = name || 'FireFerretError'
    this.scope = scope || 'General'

    Error.captureStackTrace(this, error)

    if (error) this._error = error
  }
}

module.exports.FFError = FFError
