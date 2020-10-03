![Logo](https://user-images.githubusercontent.com/15038724/94977866-9e915c80-04cf-11eb-9f4f-fd3bcf5c8a54.png)

# FireFerret

Autocaching query client for MongoDB, with powerful filtering functionality.

_We care about response times!_

[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/licenses/MIT)
[![JavaScript Style Guide: Standard](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com/ "JavaScript Standard Style")
[![Build Status](https://travis-ci.com/mster/fireferret.svg?branch=master)](https://travis-ci.com/mster/fireferret)
[![Coverage Status](https://coveralls.io/repos/github/mster/fireferret/badge.svg?branch=master)](https://coveralls.io/github/mster/fireferret?branch=master)

[![NPM](https://nodei.co/npm/fireferret.png)](https://nodei.co/npm/fireferret/)

## References

| What?             | Where?                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| API-Documentation | [https://mster.github.io/fireferret/](https://mster.github.io/fireferret/)                                                               |
| Client Config     | [https://mster.github.io/fireferret/Options.html#.FireFerretOptions](https://mster.github.io/fireferret/Options.html#.FireFerretOptions) |
| Source code       | [https://github.com/mster/fireferret](https://github.com/mster/fireferret)                                                               |
| MongoDB           | [https://www.mongodb.com/](https://www.mongodb.com/)                                                                                     |
| Redis             | [https://redis.io/](https://redis.io/)                                                                                                   |

## Requirements

FireFerret requires MongoDB and Redis instances.

## Usage

```js
const FireFerret = require("fireferret");

const ferret = new FireFerret({
  mongo: { uri: "...", collectionName: "..." },
  redis: { host: "...", port: 6379, auth_pass: "..." },
});

await ferret.connect();
const docs = await ferret.fetch({ "some.field": /.*/ });
```

Query some documents using pagination.

```js
const docs = await ferret.fetch(
  { genre: { $in: ["Djent", "Math Metal"] } },
  { pagination: { page: 3, size: 20 } }
);
```

FireFerret supports streaming queries.

```js
await ferret.fetch({ isOpen: true }, { stream: true }).pipe(res);
```

Using the Wide-Match strategy.

```js
const smartFerret = new FireFerret({
  /* ... ,*/
  wideMatch: true,
});
await smartFerret.connect();

const query = { candidates: { $ne: "Drumpf", $exists: true } };

/* cache miss */
const first50docs = await smartFerret.fetch(query, {
  pagination: { page: 1, size: 50 },
});

/* cache hit */
const first20docs = await smartFerret.fetch(query, {
  pagination: { page: 1, size: 20 },
});

/* cache hit */
const first10docs = await smartFerret.fetch(query, {
  pagination: { page: 1, size: 10 },
});

/* cache hit */
const firstDoc = await smartFerret.fetchOne(query);
```

## Contributing

We welcome you with open arms. Contributions are appreciated after `v1.0.0`

- Huge thanks to [Andrew Richtmyer](https://www.etsy.com/people/1bthcucr) for creating the FireFerret 'Pabu' artwork.
