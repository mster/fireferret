"use strict";

/* eslint-env jest */

const { generateOptions } = require("../../lib/options");

describe("Options", () => {
  test("generateOptions retains mongo defaults", function () {
    const acutal = generateOptions(
      {
        dbName: "Åkerfeldt",
        collectionName: "Mikael",
      },
      "mongo"
    );

    const expected = {
      dbName: "Åkerfeldt",
      collectionName: "Mikael",
      encoding: "utf-8",
      ndJSON: false,
      uri: "",
    };

    expect(expected).toEqual(acutal);
  });

  test("generateOptions does not add default values when using false flag", function () {
    const acutal = generateOptions(
      {
        dbName: "Åkerfeldt",
        collectionName: "Mikael",
      },
      "mongo",
      false
    );

    const expected = {
      dbName: "Åkerfeldt",
      collectionName: "Mikael",
    };

    expect(expected).toEqual(acutal);
  });

  test("generateOptions removes unsupported options", function () {
    const acutal = generateOptions(
      {
        kids: "bop 2020",
        featuring: "SoujaBoy",
        andHis: "Brand new gaming console",
      },
      "mongo"
    );

    const expected = {
      dbName: "",
      collectionName: "",
      encoding: "utf-8",
      ndJSON: false,
      uri: "",
    };

    expect(expected).toEqual(acutal);
  });

  test("generateOptions removes unsupported options", function () {
    const acutal = generateOptions(
      {
        host: "redis.red.is",
        port: 6379,
        auth_pass: "foobarfoobarfoobar",
      },
      "redisClient"
    );

    const expected = {
      ndJSON: false,
      count: 1000,
      connectionTimeout: 5000,
      batchSize: 1000,
      host: "redis.red.is",
      port: 6379,
      return_buffers: false,
      detect_buffers: false,
      socket_keepalive: true,
      socket_initial_delay: 0,
      no_ready_check: false,
      enable_offline_queue: true,
      retry_unfilfilled_commands: false,
      auth_pass: "foobarfoobarfoobar",
      family: "IPv4",
    };

    expect(expected).toEqual(acutal);
  });
});
