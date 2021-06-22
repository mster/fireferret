'use strict'

const ID_LEN = 24, BUCKET_MAX = 512

// calculate hash from mongo object id
module.exports = function hash (id) {
    if (id && (typeof id === 'string' || id instanceof String) && id.length === ID_LEN) {
        const counter = parseInt(id.slice(18), 16)
        const quotient = Math.floor(counter / BUCKET_MAX)

        return quotient.toString();
    }

    throw new Error(`Unable to calculate hash value; invalid object id: ${id}`)
}