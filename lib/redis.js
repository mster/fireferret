'use strict'

const { createClient } = require('redis')
const { promisify } = require('util')

const debug = require('util').debuglog('fireferret::redis')

/* internal */
let _ = null
let _options = {}

class RedisClient {
  constructor (options) {
    _options = { ...options }
  }

  async connect () {
    _ = createClient(_options)

    return new Promise((resolve, reject) => {
      _.on('connect', () => {
        clearTimeout(timeout)

        debug('redis client connected to: cache')

        resolve('ok')
      })

      const timeout = setTimeout(() => {
        reject(new Error('Failed to connect to Redis ...'))
      }, _options.maxWaitToConnect || 1000 * 5)
    })
  }

  async close () {
    const _quit = promisify(_.quit).bind(_)

    try {
      const reply = await _quit()

      debug('redis client closed successfully')

      return reply
    } catch (err) {
      err.constructorName = 'fireferret'
      throw err
    }
  }

  async hgetall (key) {
    const _hgetall = promisify(_.hgetall).bind(_)

    try {
      const reply = await _hgetall(key)

      return reply
    } catch (err) {
      err.constructorName = 'fireferret'
      throw err
    }
  }

  async hset (hash, ...args) {
    const _hset = promisify(_.hset).bind(_)

    try {
      await _hset(hash, args)
    } catch (err) {
      err.constructorName = 'fireferret'
      throw err
    }
  }
}

module.exports = RedisClient
