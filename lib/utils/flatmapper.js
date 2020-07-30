'use strict'

const { FFError } = require('./error')

module.exports.toFlatmap = function (json) {
  if (typeof json !== 'object') {
    throw new FFError(
      'InternalError',
      'toFlatmap requires a valid json document.'
    )
  }

  return recursiveBreakdown(json, '')
}

function recursiveBreakdown (json, prefix) {
  const temp = []

  for (const key in json) {
    const value = json[key]

    const newPrefix = `${prefix}${prefix.length > 0 ? '.' : ''}${key}`
    const constructorName = value.constructor.name

    switch (constructorName) {
      case 'Object':
        /* nested props, recurse */
        if (Object.keys(value).length > 0) {
          temp.push(...recursiveBreakdown(value, newPrefix))
        }

        /* is object, but empty */
        if (Object.keys(value).length === 0) {
          temp.push(newPrefix, '__EMPTY_OBJECT{}')
        }

        break
      case 'Array':
        temp.push(...recursiveBreakdown(value, newPrefix))
        break
      default:
        temp.push(newPrefix, value.toString())
    }
  }

  return temp
}

module.exports.fromFlatmap = function (flatmap) {
  if (typeof flatmap !== 'object') {
    throw new FFError(
      'InternalError',
      'fromFlatmap requires a valid document flatmap.'
    )
  }

  return recursiveBuildup({}, flatmap)
}

function recursiveBuildup (obj, props) {
  for (const name of Object.keys(props)) {
    /* match empty object */
    const value = props[name].includes('__EMPTY_OBJECT{}') ? {} : props[name]

    /* singular prop */
    if (name.indexOf('.') === -1) {
      obj[name] = value
    }

    /* nested prop */
    if (name.indexOf('.') > -1) {
      const remainder = name.split('.')
      const shift = remainder.shift()

      const branch = {}
      branch[remainder] = value

      if (obj[shift]) obj[shift] = recursiveBuildup(obj[shift], branch)
      else obj[shift] = recursiveBuildup({}, branch)
    }
  }

  return obj
}
