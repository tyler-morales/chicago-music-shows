/**
 * Artist thumbnail lookup. iTunes Search API first (album artwork), Wikipedia summary
 * thumbnail as fallback. No API key. Browser fetch (both send Access-Control-Allow-Origin: *).
 */
(function (root) {
  "use strict";

  const ART_CACHE_KEY = "chicago-music-shows.artist-art";
  const ART_CACHE_MAX = 200;

  /**
   * First billed artist from a show's artists string.
   * @param {string} artists
   * @returns {string}
   */
  function primaryArtist(artists) {
    const raw = String(artists == null ? "" : artists).trim();
    if (!raw) return "";
    return raw.split(/\s+\/\s+|,\s+/)[0].trim();
  }

  function itunesSearchUrl(artist) {
    return (
      "https://itunes.apple.com/search?term=" +
      encodeURIComponent(artist) +
      "&media=music&entity=album&limit=1"
    );
  }

  function wikipediaSummaryUrl(artist) {
    return (
      "https://en.wikipedia.org/api/rest_v1/page/summary/" +
      encodeURIComponent(artist.replace(/ /g, "_"))
    );
  }

  /**
   * @param {object} data iTunes search JSON
   * @returns {string|null}
   */
  function artworkFromItunesJson(data) {
    const results = data && Array.isArray(data.results) ? data.results : [];
    const first = results[0];
    if (!first) return null;
    const url = first.artworkUrl100 || first.artworkUrl60 || "";
    if (!url) return null;
    return url.replace("100x100bb", "80x80bb");
  }

  /**
   * @param {object} data Wikipedia REST summary JSON
   * @returns {string|null}
   */
  function artworkFromWikiJson(data) {
    if (!data || data.type === "disambiguation") return null;
    const thumb = data.thumbnail;
    return (thumb && thumb.source) || null;
  }

  function readArtCache(storage) {
    try {
      const parsed = JSON.parse(storage.getItem(ART_CACHE_KEY) || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const entries = parsed.entries && typeof parsed.entries === "object" ? parsed.entries : parsed;
      if (!entries || typeof entries !== "object" || Array.isArray(entries)) return {};
      return entries;
    } catch (err) {
      return {};
    }
  }

  function writeArtCache(storage, entries) {
    try {
      storage.setItem(ART_CACHE_KEY, JSON.stringify({ v: 1, entries: entries }));
    } catch (err) {
      // quota / private mode
    }
  }

  /**
   * LRU-ish: reinsert key at the end; drop oldest when over max.
   * url may be null (negative cache).
   */
  function cacheSet(entries, key, url, max) {
    const next = {};
    Object.keys(entries).forEach(function (k) {
      if (k !== key) next[k] = entries[k];
    });
    next[key] = { url: url == null ? null : url };
    const keys = Object.keys(next);
    const limit = max || ART_CACHE_MAX;
    while (keys.length > limit) {
      delete next[keys.shift()];
    }
    return next;
  }

  function cacheGet(entries, key) {
    if (!Object.prototype.hasOwnProperty.call(entries, key)) return undefined;
    const row = entries[key];
    if (row && typeof row === "object" && "url" in row) return row.url;
    if (typeof row === "string") return row;
    return null;
  }

  const api = {
    ART_CACHE_KEY: ART_CACHE_KEY,
    ART_CACHE_MAX: ART_CACHE_MAX,
    primaryArtist: primaryArtist,
    itunesSearchUrl: itunesSearchUrl,
    wikipediaSummaryUrl: wikipediaSummaryUrl,
    artworkFromItunesJson: artworkFromItunesJson,
    artworkFromWikiJson: artworkFromWikiJson,
    readArtCache: readArtCache,
    writeArtCache: writeArtCache,
    cacheSet: cacheSet,
    cacheGet: cacheGet,
  };

  root.ArtistArt = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
