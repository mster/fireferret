
![Logo](https://user-images.githubusercontent.com/15038724/94977866-9e915c80-04cf-11eb-9f4f-fd3bcf5c8a54.png)

# FireFerret [![License: MIT](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/licenses/MIT) [![JavaScript Style Guide: Standard](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com/ "JavaScript Standard Style") [![Build Status](https://travis-ci.com/mster/fireferret.svg?branch=master)](https://travis-ci.com/mster/fireferret) [![Coverage Status](https://coveralls.io/repos/github/mster/fireferret/badge.svg?branch=master)](https://coveralls.io/github/mster/fireferret?branch=master)

_Node.js Read-through cache for MongoDB_.

## References

| What?             | Where?                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| API-Documentation | [https://mster.github.io/fireferret/](https://mster.github.io/fireferret/)                                                               |
| Client Config     | [https://mster.github.io/fireferret/Options.html#.FireFerretOptions](https://mster.github.io/fireferret/Options.html#.FireFerretOptions) |
| Source code       | [https://github.com/mster/fireferret](https://github.com/mster/fireferret)                                                               |
| MongoDB           | [https://www.mongodb.com/](https://www.mongodb.com/)                                                                                     |
| Redis             | [https://redis.io/](https://redis.io/)                                                                                                   |


## Usage

Configure a FireFerret client by suppling a datastore and MongoDB connection information. 

To learn how to configure a datastore, see the [Datastores](#Datastores) section.

```js
const FireFerretClient = require("fireferret");

const cacheConfig = {
  store: require('cache-manager-redis-store'),
  host: 'localhost',
  port: 6379,
  ...
}

const ferret = new FireFerretClient({
  uri: "mongodb://endpoint:27017/?compressors=zlib",
  collection: "DefaultCollection",
  ...cacheConfig
})

await ferret.connect();

const docs = await ferret.fetch({ "some.field": /.*/ });
```

Query some documents using pagination.

```js
const query = { genre: { $in: ["Djent", "Tech Death"] } };

const pageOne = await ferret.fetch(
  query,
  { pg: [1, 20] }
);

const pageTwo = await ferret.fetch(
  query,
  { pg: [2, 20] }
);
```

## Datastores


## Contributing

We welcome you with open arms. Contributions are appreciated after `v1.0.0`

- Huge thanks to [Andrew Richtmyer](https://www.etsy.com/people/1bthcucr) for creating the FireFerret 'Pabu' artwork.
