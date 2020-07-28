'use strict'

module.exports.toFlatmap = function (json) {
  if (typeof json !== 'object') console.error('not json')

  const flatmap = recurse(json)

  return flatmap
}

function recurse (json, prefix) {
  const temp = []

  for (const ind in json) {
    if (typeof json[ind] === 'object') {
      const newPrefix = `${prefix}${prefix.length > 0 ? '.' : ''}${ind}`
      temp.push(...recurse(json[ind], newPrefix))
    }

    temp.push(ind, json[ind])
  }

  return temp
}

module.exports.fromFlatmap = function (flatmap) {
  return 0
}
