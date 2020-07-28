'use strict'

module.exports.toFlatmap = function (json) {
  if (typeof json !== 'object') console.error('not json')

  const flatmap = recurse(json, '')

  return flatmap
}

function recurse (json, prefix) {
  const temp = []

  for (const key in json) {
    const value = json[key]

    const newPrefix = `${prefix}${prefix.length > 0 ? '.' : ''}${key}`

    if (typeof value === 'object') {
      const newPrefix = `${prefix}${prefix.length > 0 ? '.' : ''}${key}`
      temp.push(...recurse(value, newPrefix))
    } else if (
      typeof value === 'number' ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      typeof value === 'function'
    ) {
      temp.push(newPrefix, value.toString())
    }
  }

  return temp
}

module.exports.fromFlatmap = function (flatmap) {
  return 0
}
