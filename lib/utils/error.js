'use strict'

class FFError extends Error {
  constructor (name, message, error) {
    super(message)
    this.name = name || 'FireFerretError'
    if (error) this._error = error
  }
}

module.exports.FFError = FFError
