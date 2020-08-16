'use strict'

const { createClient } = require('redis')
const { promisify } = require('util')
const { FFError } = require('../utils/error')
const {
  filterOpts,
  REDIS_VANILLA_OPTS,
  FF_REDIS_DEFAULTS
} = require('../utils/options')

const debug = require('util').debuglog('fireferret::redis')

/* internal */
let _ = null
let _options = {}

class RedisClient {
  constructor (options) {
    _options = {
      ...FF_REDIS_DEFAULTS,
      ...filterOpts(options, { ...REDIS_VANILLA_OPTS, ...FF_REDIS_DEFAULTS })
    }
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
        reject(
          new FFError(
            'ConnectionError',
            'failed to connected before timeout',
            'redis::connect',
            { timeout: _options.connectionTimeout }
          )
        )
      }, _options.connectionTimeout)
    })
  }

  async close () {
    const _quit = promisify(_.quit).bind(_)

    try {
      const reply = await _quit()

      debug('redis client closed successfully')

      return reply
    } catch (err) {
      throw new FFError(
        'ConnectionError',
        'close operation has failed -- quit must be invoked',
        'redis::close',
        err
      )
    }
  }

  async hgetall (key) {
    const _hgetall = promisify(_.hgetall).bind(_)

    try {
      const reply = await _hgetall(key)

      return reply
    } catch (err) {
      throw new FFError(
        'RedisError',
        'hgetall operation has failed',
        'redis::hgetall',
        err
      )
    }
  }

  async hset (hash, args) {
    const _hset = promisify(_.hset).bind(_)

    try {
      await _hset(hash, args)
    } catch (err) {
      throw new FFError(
        'RedisError',
        'hset operation has failed',
        'redis::hset',
        err
      )
    }
  }

  async lrange (key, start, end) {
    const _lrange = promisify(_.lrange).bind(_)

    try {
      if (start || end) {
        start = start || 0
        end = end || -1

        return _lrange(key, start, end)
      }

      return _lrange(key, 0, -1)
    } catch (err) {
      /* could be
      ReplyError: WRONGTYPE Operation against a key holding the wrong kind of value
      */
      throw new FFError(
        'RedisError',
        'lrange operation has failed',
        'redis::lrange',
        err
      )
    }
  }

  async lpush (key, elements, reverse = true) {
    if (!key || key.length === 0) {
      throw new FFError(
        'InvalidArguments',
        'valid key is required for lpush',
        'redis::lpush',
        { key }
      )
    }

    if (!elements || elements.length === 0) {
      throw new FFError(
        'InvalidArguments',
        'Elements are required for lpush',
        'redis::lpush',
        { elements }
      )
    }

    const _lpush = promisify(_.lpush).bind(_)
    if (reverse) elements.reverse()

    try {
      const reply = await _lpush(key, ...elements)

      return reply
    } catch (err) {
      throw new FFError(
        'RedisError',
        'lpush operation has failed',
        'redis::lpush',
        err
      )
    }
  }

  async multihgetall (keys) {
    if (!keys || keys.length === 0) {
      throw new FFError(
        'InvalidArguments',
        'keys is a required parameter',
        'redis::multihgetall',
        { keys }
      )
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
      throw new FFError(
        'RedisError',
        'one or more hgetall operations have failed',
        'redis::multihgetall',
        err
      )
    }
  }

  async multihset (hashes) {
    if (!hashes || hashes.length === 0) {
      throw new new FFError(
        'InvalidArguments',
        'hashes is a required parameter',
        'redis::multihset',
        { hashes }
      )()
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
      throw new FFError(
        'RedisError',
        'one or more hset operations have failed',
        'redis::multihset',
        err
      )
    }
  }

  async multiexists (keys) {
    if (!keys || keys.length === 0) {
      throw new FFError(
        'InvalidArguments',
        'keys is a required parameter',
        'redis::multiexists',
        { keys }
      )
    }

    const multi = _.multi()

    for (const key of keys) {
      multi.exists(key)
    }

    const exec = promisify(multi.exec).bind(multi)

    try {
      const opResponses = await exec()

      return opResponses
    } catch (err) {
      throw new FFError(
        'RedisError',
        'one or more hset operations have failed',
        'redis::multihset',
        err
      )
    }
  }

  async scan (cursor, pattern, count = _options.count) {
    if ((!cursor && cursor !== 0) || !pattern) {
      throw new FFError(
        'RedisError',
        'cursor and pattern are required parameters for a SCAN operation',
        'redis::scan',
        { cursor, pattern }
      )
    }

    const _scan = promisify(_.scan).bind(_)

    try {
      const elements = _scan(cursor, 'MATCH', pattern, 'COUNT', count)

      return elements
    } catch (err) {
      throw new FFError(
        'RedisError',
        'scan operation has failed',
        'redis::scan',
        err
      )
    }
  }

  async batchlpush (key, elements, batchSize = _options.batchSize) {
    const batchOps = []

    /* retain document parity with mongo */
    elements.reverse()

    for (let i = 0; i < elements.length; i += 0) {
      const batch = elements.splice(0, batchSize)
      if (batch.length > 0) batchOps.push(this.lpush(key, batch, false))
    }

    return Promise.all(batchOps)
  }

  async batchhgetall (keys, batchSize = _options.batchSize) {
    const batchOps = []

    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.splice(i, i + batchSize)
      batchOps.push(this.multihgetall(batch))
    }

    return Promise.all(batchOps)
  }

  async batchhset (hashes, batchSize = _options.batchSize) {
    const batchOps = []

    for (let i = 0; i < hashes.length; i += batchSize) {
      const batch = hashes.splice(i, i + batchSize)
      batchOps.push(this.multihset(batch))
    }

    return Promise.all(batchOps)
  }

  streamhgetall (keys, batchSize = _options.streamDocumentSkip) {
    /* */
  }

  nextTick (command, ...args) {
    process.nextTick(this[command], ...args)
  }
}

module.exports = RedisClient
