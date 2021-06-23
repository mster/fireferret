'use strict'

module.exports = function queryKey (dbName, collName, query = {}, range) {
  if (!dbName || !collName) throw new Error('dbName and collName are required!')

  const strQ = JSON.stringify(query)

  const [low, high] = range
  const formattedRange = low && high ? `${low}-${high}` : ''

  const raw = `${dbName}::${collName}::${strQ}::${formattedRange}`
  return raw
}
