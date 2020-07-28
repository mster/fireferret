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

    _.on('ready', () => {
      debug('redis server info', _.server_info)
    })

    return new Promise((resolve, reject) => {
      _.on('connect', () => {
        clearTimeout(timeout)

        debug('redis client connected')

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

  async lrange (key) {
    const _lrange = promisify(_.lrange).bind(_)

    try {
      console.log(key)
      const data = await _lrange(key, 0, -1)

      return data
    } catch (err) {
      /* could be
      ReplyError: WRONGTYPE Operation against a key holding the wrong kind of value
      */
      err.constructorName = 'fireferret'
      throw err
    }
  }

  async lpush (key, elements) {
    if (!elements || elements.length === 0) {
      throw new Error('elements required for lpush')
    }

    const _lpush = promisify(_.lpush).bind(_)

    try {
      const reply = await _lpush(key, ...elements)

      return reply
    } catch (err) {
      err.constructorName = 'fireferret'
      throw err
    }
  }

  async multihgetall (keys) {
    if (!keys || keys.length === 0) {
      throw new Error('keys required for multi_hgetall')
    }

    const multi = _.multi()

    for (const key of keys) {
      multi.hgetall(key)
    }

    const exec = promisify(multi.exec).bind(multi)

    try {
      const hashes = await exec()

      return hashes
    } catch (err) {
      err.constructorName = 'fireferret'
      throw err
    }
  }

  async multihset (hashes) {
    if (!hashes || hashes.length === 0) {
      throw new Error('hashes required for multi_hset')
    }

    const multi = _.multi()

    for (const hash of hashes) {
      multi.hset(hash.hname, hash.args)
    }

    const exec = promisify(multi.exec).bind(multi)

    try {
      const opResponses = await exec()

      return opResponses
    } catch (err) {
      err.constructorName = 'fireferret'
      throw err
    }
  }
}

module.exports = RedisClient
