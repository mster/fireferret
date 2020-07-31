[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/licenses/MIT)
[![JavaScript Style Guide: Standard](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com/ 'JavaScript Standard Style')
[![Build Status](https://travis-ci.com/mster/fireferret.svg?branch=master)](https://travis-ci.com/mster/fireferret)

# FireFerret

Document query and caching client for Node.js

## API

### new FireFerret ( options )

Creates a new FireFerret client.

- `options` : `<object>`

  Client options. See [options](#options)

- Returns : `<FireFerret-Client>`

### FireFerret.connect( ) : `<Async-Function>`

- Returns : `<Promise>`

  - resolve : `'ok'`

    Connection to both data stores was successful.

  - reject : `Error`

### FireFerret.close( ) : `<Async-Function>`

Closes the client.

- Returns : `<Promise>`

  - resolve : `'ok'`

    Connections have been closed successfully and client has exited.

  - reject : `Error`

### FireFerret.fetch( query ) : `<Async-Function>`

- `query`: `<object>`

  A MongoDB style query.

- Returns : `<Promise>`

  - resolve : `docs` `<Array>`

  - reject : `Error`

### FireFerret.fetchById( id ) : `<Async-Function>`

- `id`: `<string>`

  A MongoDB document ObjectId (as a string).

- Returns : `<Promise>`

  - resolve : `doc` `<object>`

  - reject : `Error`

## Options

FireFerret's options in detail.

Used for connection and configuration.

### Redis Options

FireFerret uses the [redis](https://www.npmjs.com/package/redis) package for everything Redis. That being said, FireFerret supports all of Node Redis' options.

```js
options.REDIS_OPTS = {
  host: 'redis.foo.com',
  port: 6379,
  auth_pass: 'bar'
  /* more ... */
}
```

### MongoDB Options

FireFerret uses the [mongodb](https://www.npmjs.com/package/mongodb) package for handling connections and queries to MongoDB. On top of the mongodb's options, FireFerret supports additional configuration options.

```js
options.MONGO_OPTS = {
  uri: 'mongodb+srv://foo.net',
  db: 'bar',
  collection: 'baz'
  /* more ... */
}
```
