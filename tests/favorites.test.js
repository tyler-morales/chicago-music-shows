"use strict";

const assert = require("assert");
const {
  FAVORITES_STORAGE_KEY,
  showKey,
  readFavoriteKeys,
  writeFavoriteKeys,
  filterShows,
} = require("../filter.js");

const metroA = {
  date: "2026-09-14",
  venue: "Metro",
  artists: "A",
  ticket_url: "https://example.com/a",
};
const bottleB = {
  date: "2026-09-15",
  venue: "Empty Bottle",
  artists: "B",
  ticket_url: "https://example.com/b",
};
const metroC = {
  date: "2026-09-16",
  venue: "Metro",
  artists: "C",
  ticket_url: "https://example.com/c",
};
const metroAOtherUrl = {
  date: "2026-09-14",
  venue: "Metro",
  artists: "A",
  ticket_url: "https://example.com/a-other",
};

const SHOWS = [metroA, bottleB, metroC, metroAOtherUrl];

function memoryStorage(seed) {
  const mem = Object.assign({}, seed);
  return {
    getItem: function (k) {
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
    },
    setItem: function (k, v) {
      mem[k] = String(v);
    },
  };
}

// Success: same listing fields produce the same key.
{
  assert.strictEqual(showKey(metroA), showKey({
    date: "2026-09-14",
    venue: "Metro",
    artists: "A",
    ticket_url: "https://example.com/a",
  }));
}

// Failure: different artists or ticket_url are different shows.
{
  assert.notStrictEqual(showKey(metroA), showKey(metroC));
  assert.notStrictEqual(showKey(metroA), showKey(metroAOtherUrl));
}

// Success: favorites-only returns starred shows that also pass venue/date.
{
  const keys = [showKey(metroA), showKey(bottleB)];
  const result = filterShows(SHOWS, ["Metro", "Empty Bottle"], "2026-09-14", "", true, keys);
  assert.deepStrictEqual(result.map(showKey), keys);
}

// Success: favorites-only off ignores the key set (venue/date still apply).
{
  const result = filterShows(SHOWS, ["Metro"], "2026-09-14", "", false, [showKey(bottleB)]);
  assert.deepStrictEqual(result.map(function (s) { return s.artists; }), ["A", "C", "A"]);
}

// Failure: unstarred shows are excluded when favorites-only is on.
{
  const result = filterShows(SHOWS, [], "2026-09-14", "", true, [showKey(metroA)]);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0], metroA);
  assert.ok(!result.includes(bottleB));
}

// Failure: favorites-only with no keys yields no rows.
{
  const result = filterShows(SHOWS, [], "2026-09-14", "", true, []);
  assert.deepStrictEqual(result, []);
}

// Failure: a favorite outside the date window is still excluded.
{
  const result = filterShows(SHOWS, [], "2026-09-16", "", true, [showKey(metroA), showKey(metroC)]);
  assert.deepStrictEqual(result, [metroC]);
}

// Success: round-trip persist to storage.
{
  const storage = memoryStorage();
  const keys = new Set([showKey(metroA)]);
  writeFavoriteKeys(storage, keys);
  const loaded = readFavoriteKeys(storage);
  assert.ok(loaded.has(showKey(metroA)));
  assert.strictEqual(loaded.size, 1);
  assert.ok(storage.getItem(FAVORITES_STORAGE_KEY).indexOf("Metro") !== -1);
}

// Failure: corrupt or non-array storage is treated as no favorites.
{
  const badJson = memoryStorage({});
  badJson.setItem(FAVORITES_STORAGE_KEY, "{not json");
  assert.deepStrictEqual(Array.from(readFavoriteKeys(badJson)), []);

  const notArray = memoryStorage({});
  notArray.setItem(FAVORITES_STORAGE_KEY, "{\"nope\":true}");
  assert.deepStrictEqual(Array.from(readFavoriteKeys(notArray)), []);
}

console.log("favorites.test.js: all tests passed");
