'use strict'

const pump = require('pump')
const { PassThrough } = require('stream')
const sliced = require('sliced')
const { createClient } = require('redis')
const { promisify } = require('util')

const { FFError } = require('./error')
const { fastReverse } = require('./utils')

const debug = require('util').debuglog('fireferret::redis')

/* internal */
let _client = null
let _options = {}

class RedisClient {
  constructor (options) {
    _options = options
  }

  setClient (client) {
    _client = client
  }

  getClient () {
    if (_client) return _client
  }

  async connect () {
    _client = createClient(_options)

    _client.on('ready', () => {
      debug('redis server info', _client.server_info)
    })

    return new Promise((resolve, reject) => {
      _client.on('connect', () => {
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
    const _quit = promisify(_client.quit).bind(_client)

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

  /* Single operation wrappers */
  async hget (hash, field) {
    const _hget = promisify(_client.hget).bind(_client)

    try {
      return _hget(hash, field)
    } catch (err) {
      throw new FFError(
        'RedisError',
        'hget operation has failed',
        'redis::hget',
        err
      )
    }
  }

  async hmget (key, fields) {
    const _hmget = promisify(_client.hmget).bind(_client)

    try {
      return _hmget(key, fields)
    } catch (err) {
      throw new FFError(
        'RedisError',
        'hmget operation has failed',
        'redis::hmget',
        err
      )
    }
  }

  async hset (hash, args) {
    const _hset = promisify(_client.hset).bind(_client)

    try {
      await _hset(hash, args)
    } catch (err) {
      debug(err)
      throw new FFError(
        'RedisError',
        'hset operation has failed',
        'redis::hset',
        err
      )
    }
  }

  async hmset (key, args) {
    const _hmset = promisify(_client.hmset).bind(_client)

    try {
      await _hmset(key, args)
    } catch (err) {
      throw new FFError(
        'RedisError',
        'hmset operation has failed',
        'redis::hmset',
        err
      )
    }
  }

  async lrange (key, start, end) {
    const _lrange = promisify(_client.lrange).bind(_client)

    try {
      if (start || end) {
        start = start || 0
        end = end || -1

        return _lrange(key, start, end)
      }

      return _lrange(key, 0, -1)
    } catch (err) {
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

    const _lpush = promisify(_client.lpush).bind(_client)
    if (reverse) fastReverse(elements)

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

  async scan (cursor, pattern, count = _options.count) {
    if ((!cursor && cursor !== 0) || !pattern) {
      throw new FFError(
        'RedisError',
        'cursor and pattern are required parameters for a SCAN operation',
        'redis::scan',
        { cursor, pattern }
      )
    }

    const _scan = promisify(_client.scan).bind(_client)

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

  /* Async multi operations */
  async multihmget (operations, stream) {
    const hashes = Object.keys(operations)

    if (!stream) {
      const multi = _client.multi()

      for (let i = 0; i < hashes.length; i++) {
        multi.hmget(hashes[i], operations[hashes[i]])
      }

      const exec = promisify(multi.exec).bind(multi)

      try {
        const collation = await exec()

        return collation
      } catch (err) {
        throw new FFError(
          'RedisError',
          'one or more hgetall operations have failed',
          'redis::multihmget',
          err
        )
      }
    }

    /* using streams */
    const source = PassThrough()
    const sink = PassThrough()

    let fresh = true
    for (
      let i = 0, hash = hashes[i];
      i < hashes.length;
      i++, hash = hashes[i]
    ) {
      this.hmget(hash, operations[hash]).then((bucket) => {
        source.write(
          `${
            (fresh && !_options.ndJSON ? '[' : '') +
            bucket.join(!_options.ndJSON ? ',' : '\n')
          }`
        )
        fresh = false

        /* if this is the last bucket, end the stream appropriately */
        if (_options.ndJSON && i === hashes.length - 1) source.end()
        if (!_options.ndJSON && i === hashes.length - 1) source.end(']')
        else if (!_options.ndJSON) {
          /* 'join' the batches together (array return) */
          source.write(',')
        }
      })
    }

    pump(source, sink)

    return sink
  }

  /* Batch operations wrap single operation */
  async batchlpush (key, elements, batchSize = _options.batchSize) {
    if (batchSize > elements.length) return this.lpush(key, elements, true)

    const elementCount = elements.length
    const batchOps = []

    /* retain document parity with mongo */
    fastReverse(elements)

    for (let i = 0; i < Math.ceil(elementCount / batchSize); i += 1) {
      const end =
        elementCount < (i + 1) * batchSize ? elementCount : (i + 1) * batchSize
      const batch = sliced(elements, i * batchSize, end)
      if (batch.length > 0) batchOps.push(this.lpush(key, batch, false))
    }

    return Promise.all(batchOps)
  }
}

module.exports = RedisClient
