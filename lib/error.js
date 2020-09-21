'use strict'

/**
 * Creates a new FireFerret Error
 * @constructor
 * @param {name} [name='FireFerretError'] - The error name
 * @param {msg} [msg=''] - The error message.
 * @param {scope} [scope=''] - The scope where the error was thrown.
 * @param {error} [error=null] - The original error message, invalid options, or invalid argument list.
 * @returns {FireFerretError}
 */
class FerretError extends Error {
  constructor (name, msg, scope, error) {
    super(msg)
    this.name = name || 'FireFerretError'
    this.msg = msg || ''
    this.scope = scope || ''

    if (error) this._error = error
  }
}

/**
 * Error to string.
 * @returns {string} - The FireFerretError as a string.
 */
FerretError.prototype.toString = function () {
  const obj = Object(this)
  if (obj !== this) throw new TypeError()

  return `${this.name}: ${this.msg}` + this.scope
    ? `\n${this.scope}`
    : '' + this._error
      ? `\n${this._error}`
      : ''
}

FerretError.prototype.inspect = function () {
  return this.toString()
}

module.exports.FerretError = FerretError
