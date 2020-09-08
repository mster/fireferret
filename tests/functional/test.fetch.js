"use strict";

/* eslint-env jest */

const { PassThrough } = require("stream");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { createClient } = require("redis-mock");
const FireFerret = require("../../lib/client");
const fireferret = require("../..");

/* using default docs scheme from https://www.npmjs.com/package/socuments */
const printer = require("socuments");
const deepClone = require("clone-deep");

let ferret;
let mongoServer;
let redis;
let docs;
let ids;

beforeAll(async (done) => {
  jest.setTimeout(1200000);

  redis = createClient();
  mongoServer = new MongoMemoryServer();
  const uri = await mongoServer.getConnectionString();

  const opts = {
    mongo: { uri, collectionName: "test" },
    redis: {},
  };
  ferret = new FireFerret(opts);
  ferret.cache.setClient(redis);
  await ferret.connect();

  docs = printer(20);

  const mongo = ferret.mongo.getClient();
  const { insertedIds } = await mongo
    .db()
    .collection(opts.mongo.collectionName)
    .insertMany(docs);
  ids = insertedIds;

  done();
});

afterAll(async (done) => {
  await ferret.close();
  await mongoServer.stop();
  redis.quit();
  done();
});

describe("fetch", function () {
  it("should return hydrated documents using the default query", async function (done) {
    const query = null;
    const queryOptions = { hydrate: true };

    const firstRequest = await ferret.fetch(query, queryOptions);
    expect(firstRequest).toEqual(docs);
    const secondRequest = await ferret.fetch(query, queryOptions);
    expect(secondRequest).toEqual(docs);

    done();
  });

  it("should return documents without hydrating", async function (done) {
    const query = null;
    const queryOptions = null;

    const expected = JSON.parse(JSON.stringify(docs));

    await ferret.fetch(query, queryOptions); /* prime cache */
    const firstRequest = await ferret.fetch(query, queryOptions);
    expect(firstRequest).toEqual(expected);
    const secondRequest = await ferret.fetch(query, queryOptions);
    expect(secondRequest).toEqual(expected);

    done();
  });

  it("should return hydrated documents that match a query", async function (done) {
    const query = { onEarth: true };
    const queryOptions = { hydrate: true };

    const expected = deepClone(docs).filter((v) => v.onEarth === true);

    const firstRequest = await ferret.fetch(query, queryOptions);
    expect(firstRequest).toEqual(expected);
    const secondRequest = await ferret.fetch(query, queryOptions);
    expect(secondRequest).toEqual(expected);

    done();
  });

  it("should obey pagination rules", async function (done) {
    const query = {};
    const queryOptions = { hydrate: true, pagination: { page: 1, size: 1 } };

    const expected = deepClone(docs).slice(0, 1);

    await ferret.fetch(query, queryOptions);
    const firstRequest = await ferret.fetch(query, queryOptions);
    expect(firstRequest).toEqual(expected);
    const secondRequest = await ferret.fetch(query, queryOptions);
    expect(secondRequest).toEqual(expected);

    done();
  });

  it("should obey pagination rules", async function (done) {
    const query = {};
    const queryOptions = { hydrate: true, pagination: { page: 1, size: 5 } };

    const expected = deepClone(docs).slice(0, 5);

    await ferret.fetch(query, queryOptions);
    const firstRequest = await ferret.fetch(query, queryOptions);
    expect(firstRequest).toEqual(expected);
    const secondRequest = await ferret.fetch(query, queryOptions);
    expect(secondRequest).toEqual(expected);

    done();
  });

  it("should return a stream when using the queryOptions.stream", async function (done) {
    const query = {};
    const queryOptions = { stream: true };

    const expected = JSON.parse(JSON.stringify(docs));

    const stream = await ferret.fetch(query, queryOptions);
    expect(stream.constructor).toBe(PassThrough);

    let chunks = "";
    stream.on("data", (chunk) => (chunks += chunk));
    stream.on("end", () => {
      const actual = JSON.parse(chunks);
      expect(actual).toEqual(expected);

      done();
    });
  });

  it("should return a stream that obeys pagination when using the queryOptions.stream", async function (done) {
    const query = {};
    const queryOptions = { stream: true, pagination: { page: 1, size: 5 } };

    const expected = JSON.parse(JSON.stringify(docs)).slice(0, 5);

    const stream = await ferret.fetch(query, queryOptions);
    expect(stream.constructor).toBe(PassThrough);

    let chunks = "";
    stream.on("data", (chunk) => (chunks += chunk));
    stream.on("end", () => {
      const actual = JSON.parse(chunks);
      expect(actual).toEqual(expected);

      done();
    });
  });
});

describe("fetchOne", function () {
  it("should return the first document that matches the query", async function (done) {
    const query = {};
    const queryOptions = null;

    const expected = JSON.parse(JSON.stringify(docs))[0];

    await ferret.fetchOne(query, queryOptions); /* prime cache */
    const firstRequest = await ferret.fetchOne(query, queryOptions);
    expect(firstRequest).toEqual(expected);
    const secondRequest = await ferret.fetchOne(query, queryOptions);
    expect(secondRequest).toEqual(expected);

    done();
  });

  it("should return the first hydrated document that matches the query", async function (done) {
    const query = {};
    const queryOptions = { hydrate: true };

    const expected = deepClone(docs)[0];

    const firstRequest = await ferret.fetchOne(query, queryOptions);
    expect(firstRequest).toEqual(expected);
    const secondRequest = await ferret.fetchOne(query, queryOptions);
    expect(secondRequest).toEqual(expected);

    done();
  });
});

describe("fetchById", function () {
  it("should return a document with matching _id", async function (done) {
    const id = Object.values(ids)[0];
    const query = {};
    const queryOptions = null;

    /* gotta add le _id */
    const expected = {
      ...JSON.parse(JSON.stringify(docs))[0],
      _id: id.toHexString(),
    };

    await ferret.fetchById(id, queryOptions); /* prime cache */
    const firstRequest = await ferret.fetchById(id, queryOptions);
    expect(firstRequest).toEqual(expected);
    const secondRequest = await ferret.fetchById(id, queryOptions);
    expect(secondRequest).toEqual(expected);

    done();
  });

  it("should return a hydrated document with matching _id", async function (done) {
    const id = Object.values(ids)[0];
    const query = {};
    const queryOptions = { hydrate: true };

    /* gotta add le _id */
    const expected = { ...deepClone(docs)[0], _id: id };

    const firstRequest = await ferret.fetchById(id, queryOptions);
    expect(firstRequest).toEqual(expected);
    const secondRequest = await ferret.fetchOne(id, queryOptions);
    expect(secondRequest).toEqual(expected);

    done();
  });
});
