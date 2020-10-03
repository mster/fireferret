'use strict'

const matflap = require('matflap')

/**
 * Creates a new Bucket instance
 *
 * @constructor
 * @param {String} [hash=null] - The hash value of the Bucket.
 * @param {Array|Object} [elements=null] - Any element(s) to add to the bucket.
 *
 * @returns {Bucket}
 */
class Bucket {
  constructor (hash = null, elements = null) {
    this.hash = hash

    this._ = []
    this._size = 0
    if (elements) this.add(elements)
  }

  add (elements) {
    if (!elements) return

    const isArray = Array.isArray(elements)

    if (isArray) {
      const flatMap = matflap(elements, (element) => [
        element._id.toHexString(),
        JSON.stringify(element)
      ])
      this._.push(...flatMap)
      this._size += elements.length
    }

    if (elements.constructor.name === 'Object' && !isArray) {
      this._.push(elements._id.toHexString(), JSON.stringify(elements))
      this._size++
    }
  }
}

function makeBucket (hash, elements) {
  return new Bucket(hash, elements)
}

/*
  2^24 / 2^9 = 2^15 possible buckets

  https://redis.io/topics/memory-optimization

  Note: MongoDB ObjectID counter value (last 3 bytes) may not be unique in rare circumstances.
  This may degrade look-up performance slightly, but will not change the behavior of bucketing.
 */
function hashFunction (documentID) {
  const hexString =
    documentID.constructor.name === 'String'
      ? documentID
      : documentID.toHexString()

  const counter = parseInt(hexString.slice(18), 16)
  const quotient = Math.floor(counter / 512)

  return quotient.toString()
}

module.exports = { Bucket, makeBucket, hashFunction }
