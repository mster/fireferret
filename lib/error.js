'use strict'

class FerretError extends Error {
  constructor (name, msg, scope, error) {
    super(msg)
    this.name = name || 'FireFerretError'
    this.msg = msg || ''
    this.scope = scope || ''

    if (error) this._error = error
  }
}

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

module.exports.FFError = FerretError
