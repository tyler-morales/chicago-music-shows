"use strict";

const assert = require("assert");
const { filterShows, selectedVenueValues, clearVenueSelection } = require("../filter.js");

const SHOWS = [
  { date: "2026-09-14", venue: "Metro", artists: "A" },
  { date: "2026-09-15", venue: "Empty Bottle", artists: "B" },
  { date: "2026-09-16", venue: "Metro", artists: "C" },
  { date: "2026-09-20", venue: "Thalia Hall", artists: "D" },
  { date: "2026-08-01", venue: "Metro", artists: "Past" },
];

function venuesOf(rows) {
  return rows.map(function (s) {
    return s.venue + "|" + s.date;
  });
}

// Success: empty venue selection is no venue filter (all venues in the date window).
{
  const result = filterShows(SHOWS, [], "2026-09-14", "");
  assert.deepStrictEqual(venuesOf(result), [
    "Metro|2026-09-14",
    "Empty Bottle|2026-09-15",
    "Metro|2026-09-16",
    "Thalia Hall|2026-09-20",
  ]);
}

// Success: multiple venues OR together, AND with the date range.
{
  const result = filterShows(SHOWS, ["Metro", "Thalia Hall"], "2026-09-14", "2026-09-20");
  assert.deepStrictEqual(venuesOf(result), [
    "Metro|2026-09-14",
    "Metro|2026-09-16",
    "Thalia Hall|2026-09-20",
  ]);
}

// Failure: a venue outside the selected set is excluded.
{
  const result = filterShows(SHOWS, ["Metro"], "2026-09-14", "");
  assert.ok(result.every(function (s) { return s.venue === "Metro"; }));
  assert.strictEqual(result.some(function (s) { return s.venue === "Empty Bottle"; }), false);
}

// Failure: dates before From or after To are excluded even when the venue matches.
{
  const result = filterShows(SHOWS, ["Metro"], "2026-09-15", "2026-09-16");
  assert.deepStrictEqual(venuesOf(result), ["Metro|2026-09-16"]);
}

// Failure: empty input yields no rows.
{
  const result = filterShows([], ["Metro"], "2026-09-14", "");
  assert.deepStrictEqual(result, []);
}

// Success: selectedVenueValues reads only selected options.
{
  const select = {
    selectedOptions: [
      { value: "Metro", selected: true },
      { value: "", selected: true },
    ],
  };
  assert.deepStrictEqual(selectedVenueValues(select), ["Metro"]);
}

// Success: clearVenueSelection deselects every option (back to all venues).
{
  const options = [
    { value: "Metro", selected: true },
    { value: "Empty Bottle", selected: true },
  ];
  clearVenueSelection({ options: options });
  assert.ok(options.every(function (opt) { return opt.selected === false; }));
}

console.log("filter.test.js: all tests passed");
