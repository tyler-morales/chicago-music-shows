/**
 * Pure show-filtering helpers. Loaded as a script in the browser and required by tests.
 * Empty venue selection means no venue filter (show all venues).
 * Optional favorites-only is AND with venue/date; keys persist via localStorage helpers.
 */
(function (root) {
  "use strict";

  const FAVORITES_STORAGE_KEY = "chicago-music-shows.favorites";

  /**
   * Stable identity so a favorite survives data refreshes of the same listing.
   * date + venue + artists is the show; ticket_url splits aggregator duplicates.
   * @param {object} show
   * @returns {string}
   */
  function showKey(show) {
    const s = show || {};
    return JSON.stringify([
      s.date || "",
      s.venue || "",
      s.artists || "",
      s.ticket_url || "",
    ]);
  }

  /**
   * @param {Storage} storage
   * @returns {Set<string>}
   */
  function readFavoriteKeys(storage) {
    try {
      const raw = storage && storage.getItem(FAVORITES_STORAGE_KEY);
      const parsed = JSON.parse(raw || "[]");
      if (!Array.isArray(parsed)) return new Set();
      return new Set(
        parsed.filter(function (k) {
          return typeof k === "string" && k.length > 0;
        })
      );
    } catch (err) {
      return new Set();
    }
  }

  /**
   * @param {Storage} storage
   * @param {Set<string>|string[]} keys
   */
  function writeFavoriteKeys(storage, keys) {
    try {
      if (!storage || typeof storage.setItem !== "function") return;
      storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(keys || [])));
    } catch (err) {
      // Quota / private mode: keep in-memory favorites; skip persist.
    }
  }

  /**
   * Filter shows by optional venue set (OR) and date range (AND).
   * When favoritesOnly is true, also require the show key to be in favoriteKeys.
   * @param {Array<object>} shows
   * @param {string[]} selectedVenues empty means all venues
   * @param {string} fromDate inclusive YYYY-MM-DD; empty skips the lower bound
   * @param {string} toDate inclusive YYYY-MM-DD; empty skips the upper bound
   * @param {boolean} [favoritesOnly]
   * @param {Set<string>|string[]} [favoriteKeys]
   * @returns {Array<object>}
   */
  function filterShows(shows, selectedVenues, fromDate, toDate, favoritesOnly, favoriteKeys) {
    const venueSet =
      selectedVenues && selectedVenues.length ? new Set(selectedVenues) : null;
    const from = fromDate || "";
    const to = toDate || "";
    const favSet = favoritesOnly
      ? (favoriteKeys instanceof Set ? favoriteKeys : new Set(favoriteKeys || []))
      : null;

    return shows.filter(function (s) {
      const date = s.date || "";
      if (from && date < from) return false;
      if (to && date > to) return false;
      if (venueSet && !venueSet.has(s.venue || "")) return false;
      if (favSet && !favSet.has(showKey(s))) return false;
      return true;
    });
  }

  /**
   * @param {HTMLSelectElement} selectEl
   * @returns {string[]}
   */
  function selectedVenueValues(selectEl) {
    return Array.from(selectEl.selectedOptions)
      .map(function (opt) {
        return opt.value;
      })
      .filter(Boolean);
  }

  /**
   * Clear a multi-select so nothing is selected (all venues).
   * @param {HTMLSelectElement} selectEl
   */
  function clearVenueSelection(selectEl) {
    Array.from(selectEl.options).forEach(function (opt) {
      opt.selected = false;
    });
  }

  const api = {
    FAVORITES_STORAGE_KEY: FAVORITES_STORAGE_KEY,
    showKey: showKey,
    readFavoriteKeys: readFavoriteKeys,
    writeFavoriteKeys: writeFavoriteKeys,
    filterShows: filterShows,
    selectedVenueValues: selectedVenueValues,
    clearVenueSelection: clearVenueSelection,
  };

  root.ShowsFilter = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
