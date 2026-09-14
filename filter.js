/**
 * Pure show-filtering helpers. Loaded as a script in the browser and required by tests.
 * Empty venue selection means no venue filter (show all venues).
 */
(function (root) {
  "use strict";

  /**
   * Filter shows by optional venue set (OR) and date range (AND).
   * @param {Array<object>} shows
   * @param {string[]} selectedVenues empty means all venues
   * @param {string} fromDate inclusive YYYY-MM-DD; empty skips the lower bound
   * @param {string} toDate inclusive YYYY-MM-DD; empty skips the upper bound
   * @returns {Array<object>}
   */
  function filterShows(shows, selectedVenues, fromDate, toDate) {
    const venueSet =
      selectedVenues && selectedVenues.length ? new Set(selectedVenues) : null;
    const from = fromDate || "";
    const to = toDate || "";

    return shows.filter(function (s) {
      const date = s.date || "";
      if (from && date < from) return false;
      if (to && date > to) return false;
      if (venueSet && !venueSet.has(s.venue || "")) return false;
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
    filterShows: filterShows,
    selectedVenueValues: selectedVenueValues,
    clearVenueSelection: clearVenueSelection,
  };

  root.ShowsFilter = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
