"use strict";

const assert = require("assert");
const {
  splitArtists,
  primaryArtist,
  spotifySearchUrl,
  artistSpotifySegments,
  itunesSearchUrl,
  wikipediaSummaryUrl,
  artworkFromItunesJson,
  artworkFromWikiJson,
  readArtCache,
  writeArtCache,
  cacheSet,
  cacheGet,
  ART_CACHE_KEY,
  ART_CACHE_MAX,
} = require("../artist-art.js");

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

// Success: first billed artist before " / " or comma.
{
  assert.strictEqual(primaryArtist("Bob Log III / Baron Von Future"), "Bob Log III");
  assert.strictEqual(primaryArtist("Ganser"), "Ganser");
  assert.deepStrictEqual(splitArtists("Bob Log III / Baron Von Future"), [
    "Bob Log III",
    "Baron Von Future",
  ]);
  assert.deepStrictEqual(splitArtists("Austin Cash, Luke Callen, and Ultra-Violet Archer"), [
    "Austin Cash",
    "Luke Callen",
    "and Ultra-Violet Archer",
  ]);
  assert.deepStrictEqual(splitArtists("Carla Dal Forno / Zelienople / Erik Kramer"), [
    "Carla Dal Forno",
    "Zelienople",
    "Erik Kramer",
  ]);
}

// Failure: empty / missing artists yield an empty primary name (no lookup).
{
  assert.strictEqual(primaryArtist(""), "");
  assert.strictEqual(primaryArtist(null), "");
  assert.deepStrictEqual(splitArtists(""), []);
  assert.deepStrictEqual(splitArtists("   "), []);
  assert.deepStrictEqual(splitArtists(null), []);
}

// Success: Spotify search URL is secret-free and encodes the artist name.
{
  assert.strictEqual(
    spotifySearchUrl("Bob Log III"),
    "https://open.spotify.com/search/Bob%20Log%20III"
  );
  const segs = artistSpotifySegments("Bob Log III / Baron Von Future");
  assert.strictEqual(segs.length, 3);
  assert.strictEqual(segs[0].type, "artist");
  assert.strictEqual(segs[0].href, "https://open.spotify.com/search/Bob%20Log%20III");
  assert.strictEqual(segs[1].type, "sep");
  assert.strictEqual(segs[1].text, " / ");
  assert.strictEqual(segs[2].name, "Baron Von Future");
  assert.strictEqual(segs[2].href, "https://open.spotify.com/search/Baron%20Von%20Future");
}

// Failure: blank artist names are not Spotify links.
{
  assert.strictEqual(spotifySearchUrl(""), "");
  assert.strictEqual(spotifySearchUrl("   "), "");
  assert.deepStrictEqual(artistSpotifySegments(""), []);
  assert.deepStrictEqual(artistSpotifySegments(null), []);
}

// Success: iTunes result with artworkUrl100.
{
  const url = artworkFromItunesJson({
    results: [{ artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg" }],
  });
  assert.strictEqual(url, "https://is1-ssl.mzstatic.com/image/thumb/x/80x80bb.jpg");
}

// Failure: empty iTunes results / missing artwork.
{
  assert.strictEqual(artworkFromItunesJson({ results: [] }), null);
  assert.strictEqual(artworkFromItunesJson({ results: [{}] }), null);
  assert.strictEqual(artworkFromItunesJson(null), null);
}

// Success: Wikipedia thumbnail.
{
  assert.strictEqual(
    artworkFromWikiJson({ thumbnail: { source: "https://thumb.wikimedia.org/x.jpg" } }),
    "https://thumb.wikimedia.org/x.jpg"
  );
}

// Failure: disambiguation or missing thumbnail.
{
  assert.strictEqual(artworkFromWikiJson({ type: "disambiguation", thumbnail: { source: "https://x" } }), null);
  assert.strictEqual(artworkFromWikiJson({}), null);
}

{
  const u = itunesSearchUrl("Ganser");
  assert.ok(u.indexOf("itunes.apple.com/search") !== -1);
  assert.ok(u.indexOf("Ganser") !== -1);
  const w = wikipediaSummaryUrl("Radiohead");
  assert.ok(w.indexOf("en.wikipedia.org/api/rest_v1/page/summary/Radiohead") !== -1);
}

// Success: cache round-trip; Failure: corrupt JSON is empty.
{
  const storage = memoryStorage();
  let entries = cacheSet({}, "ganser", "https://img.example/g.jpg", 2);
  writeArtCache(storage, entries);
  const loaded = readArtCache(storage);
  assert.strictEqual(cacheGet(loaded, "ganser"), "https://img.example/g.jpg");

  const bad = memoryStorage();
  bad.setItem(ART_CACHE_KEY, "{nope");
  assert.deepStrictEqual(readArtCache(bad), {});
}

// Failure: cache stays bounded (oldest key dropped).
{
  let entries = {};
  for (let i = 0; i < ART_CACHE_MAX + 5; i++) {
    entries = cacheSet(entries, "a" + i, "https://x/" + i, ART_CACHE_MAX);
  }
  assert.strictEqual(Object.keys(entries).length, ART_CACHE_MAX);
  assert.strictEqual(cacheGet(entries, "a0"), undefined);
  assert.ok(cacheGet(entries, "a" + (ART_CACHE_MAX + 4)));
}

console.log("artist-art.test.js: all tests passed");
