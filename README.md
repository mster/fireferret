# FireFerret

Document query and caching client for Node.js

## API

`new fireFerret(options)` : `function`

- `options` : `<object>`

- `returns` : `<FireFerret-Client>`

`fireFerret.connect()` : `async function`

- `returns` : `<Promise>`

  - `resolve` : `'ok'`

  - `reject` : `Error`

`fireFerret.close()` : `async function`

- `returns` : `<Promise>`

  - `resolve` : `'ok'`

  - `reject` : `Error`

`fireFerret.fetch(query)` : `async function`

- `returns` : `<Promise>`

  - `resolve` : `docs` `<Array>`

  - `reject` : `Error`

`fireFerret.fetchById(id)` : `async function`

- `returns` : `<Promise>`

  - `resolve` : `doc` `<object>`

  - `reject` : `Error`

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
