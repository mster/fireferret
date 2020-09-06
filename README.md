## Hello there!

### Thank you for checking out FireFerret!

Currently (as of `v0.0.2`), FireFerret is unstable and deemed experiment. Please **AVOID** using this package in production until a stable version is released.

Stable releases will be designated by versions greater than `1.0.0` and are planned for September 2020.

# FireFerret

Document query and caching client for Node.js

[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](https://opensource.org/licenses/MIT)
[![JavaScript Style Guide: Standard](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com/ "JavaScript Standard Style")
[![Build Status](https://travis-ci.com/mster/fireferret.svg?branch=master)](https://travis-ci.com/mster/fireferret)
[![Coverage Status](https://coveralls.io/repos/github/mster/fireferret/badge.svg?branch=test/code-coverage)](https://coveralls.io/github/mster/fireferret?branch=test/code-coverage)

[![NPM](https://nodei.co/npm/fireferret.png)](https://nodei.co/npm/fireferret/)

## References

| What?             | Where?                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| API-Documentation | [https://mster.github.io/fireferret/](https://mster.github.io/fireferret/)                                                               |
| Config            | [https://mster.github.io/fireferret/Options.html#.FireFerretOptions](https://mster.github.io/fireferret/Options.html#.FireFerretOptions) |
| Source            | [https://github.com/mster/fireferret](https://github.com/mster/fireferret)                                                               |
| MongoDB           | [https://www.mongodb.com/](https://www.mongodb.com/)                                                                                     |
| Redis             | [https://redis.io/](https://redis.io/)                                                                                                   |

## Requirements

FireFerret requires MongoDB and Redis instances. These may be local or remote, Ferret don't give-a-hoot!

## Usage

Query some documents using pagination.

```js
const FireFerret = require("FireFerret");

const ferret = new FireFerret(options);
await ferret.connect();

const docs = await ferret.fetch(
  { genre: { $in: ["Djent", "Math Metal"] } },
  { pagination: { page: 3, size: 20 } }
);
```

FireFerret supports streaming queries.

```js
const awesomePackages = await ferret.fetch({ author: "nw" }, { stream: true });

awesomePackages.pipe(res);
```

Using the Wide-Match strategy.

```js
const smartFerret = new FireFerret({ /* ... ,*/ wideMatch: true });
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

/* anotha one, cache hit */
const first10docs = await smartFerret.fetch(query, {
  pagination: { page: 1, size: 10 },
});

/* anotha one, cache hit */
const firstDoc = await smartFerret.fetchOne(query);
```

## Contributing

We welcome you with open arms. Contributions are appreciate after `v1.0.0`
