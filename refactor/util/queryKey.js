'use strict'

const btoa = require('btoa')

module.exports = function queryKey(dbName, collName, query={}, range) {
    if (!dbName || !collName) throw new Error('dbName and collName are required!')

    const strQ = JSON.stringify(query)
    const formattedRange = range ? `${range[0]}-${range[1]}` : ``
    const raw = `${dbName}:${collName}:${strQ}:${formattedRange}`
    return raw
}