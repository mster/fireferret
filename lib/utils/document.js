'use strict'

module.exports.coerce = function (document) {
  const keys = Object.keys(document)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (key === '_id') document[key] = this.formatObjectID(document[key])

    if (!isNaN(document[key])) document[key] = Number(document[key])
    if (document[key] === 'true' || document[key] === false) document[key] = Boolean(document[key])
  }
  return document
}
