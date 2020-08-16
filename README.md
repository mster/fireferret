## Hello there!
### Thank you for checking out FireFerret!

Currently (as of `v0.0.2`), FireFerret is unstable and deemed experiment. Please **AVOID** using this package in production until a stable version is released. 

Stable releases will be designated by versions greater than `1.0.0` and are planned for September 2020.

# FireFerret

[![NPM](https://nodei.co/npm/fireferret.png)](https://nodei.co/npm/fireferret/)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/licenses/MIT)
[![JavaScript Style Guide: Standard](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com/ 'JavaScript Standard Style')
[![Build Status](https://travis-ci.com/mster/fireferret.svg?branch=master)](https://travis-ci.com/mster/fireferret)

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

  - reject : `<FireFerret-Error>`

### FireFerret.close( ) : `<Async-Function>`

Closes the client.

- Returns : `<Promise>`

  - resolve : `'ok'`

    Connections have been closed successfully and client has exited.

  - reject : `<FireFerret-Error>`

### FireFerret.fetch( query [, options ] ) : `<Async-Function>`

- `query`: `<object>`

  A MongoDB style query.

- `options`: `<object>`

  Supported fetch options

- Returns : `<Promise>`

  - resolve : `docs` `<Array>`

  - reject : `<FireFerret-Error>`

### FireFerret.fetchById( id ) : `<Async-Function>`

- `id`: `<string>` | `<ObjectID>`

  A MongoDB document id as a String or ObjectID.

- Returns : `<Promise>`

  - resolve : `<object>` | `null`

  - reject : `<FireFerret-Error>`

### FireFerret.fetchOne( query ) : `<Async-Function>`

- `id`: `<string>`

  A MongoDB style query.

- Returns : `<Promise>`

  - resolve : `<object>` | `null`

  - reject : `<FireFerret-Error>`

## Options

FireFerret's options in detail.

Used for connection and configuration.

```js
options = {
  wideMatch: false,
  redisJSON: true,
  globPagination: true,
  REDIS_OPTS: { /* ... */ },
  MONGO_OPTS: { /* ... */ }
}
```

### Wide-match

Attempt to use previously cached queries as a means of fulfilling a non-cached query. Wide-match can drastically improve performance of applications that frequently use `20;50;100` pagination.

Enable wide-match by setting `wideMatch: true` in `options`.

### Redis-JSON

By default FireFerret uses hashes to cache individual documents. That being said, you can use (or make your own) redis json client to request and modify object properties specifically.

If the redis-json option is disabled, documents will be cached as strings.

Disable redis-json by setting `redisJSON: false` in `options`.

### Glob-Pagination

Coming soon ...

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
