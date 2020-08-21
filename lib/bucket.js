'use strict'

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
      const flatMap = elements.flatMap((element) => [
        element._id.toHexString(),
        JSON.stringify(element)
      ])
      this._.push(flatMap)
      this._size += elements.length
    }

    if (elements.constructor.name === 'Object' && !isArray) {
      this._.push(elements._id.toHexString(), JSON.stringify(elements))
      this._size++
    }
  }

  offload () {
    return this._
  }
}

function makeBucket (hash, elements) {
  return new Bucket(hash, elements)
}

function hashFunction (documentID) {
  const hexString =
    documentID.constructor.name === 'String'
      ? documentID
      : documentID.toHexString()

  const counter = parseInt(hexString.slice(17), 16)
  const quotient = Math.floor(counter / 512)

  return quotient.toString()
}

module.exports = { Bucket, makeBucket, hashFunction }
