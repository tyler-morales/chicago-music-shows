#!/usr/bin/env python3
"""Success and failure tests for the shows updater date window and merge."""

from __future__ import annotations

import sys
import unittest
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import update_shows as u  # noqa: E402


def show(
    day: str,
    venue: str = "Metro",
    artists: str = "A",
    ticket_url: str = "https://example.com/a",
) -> dict:
    return {
        "date": day,
        "doors_or_time": "20:00",
        "venue": venue,
        "venue_address": "",
        "artists": artists,
        "ticket_url": ticket_url,
        "source": "test",
        "notes": "",
    }


class EndDateForWindowTests(unittest.TestCase):
    def test_success_september_2026_reaches_end_of_2027(self) -> None:
        self.assertEqual(u.end_date_for_window(date(2026, 9, 14)), date(2027, 12, 31))

    def test_success_near_year_end_still_reaches_2027(self) -> None:
        today = date(2026, 12, 15)
        end = u.end_date_for_window(today)
        self.assertGreaterEqual(end, date(2027, 12, 31))
        self.assertGreaterEqual(end, today + timedelta(days=90))

    def test_success_next_calendar_year_after_2027(self) -> None:
        self.assertEqual(u.end_date_for_window(date(2027, 6, 1)), date(2028, 12, 31))

    def test_failure_does_not_stop_at_2026_year_end(self) -> None:
        self.assertNotEqual(u.end_date_for_window(date(2026, 9, 14)), date(2026, 12, 31))
        self.assertGreater(u.end_date_for_window(date(2026, 9, 14)), date(2026, 12, 31))


class MergeShowsWindowTests(unittest.TestCase):
    def test_success_includes_scraped_2027_date_inside_window(self) -> None:
        existing = [show("2026-09-14")]
        scraped = [show("2027-05-26", artists="The Airborne Toxic Event")]
        merged = u.merge_shows(existing, scraped, date(2026, 9, 14), date(2027, 12, 31))
        dates = [s["date"] for s in merged]
        self.assertIn("2027-05-26", dates)
        self.assertIn("2026-09-14", dates)

    def test_failure_drops_new_shows_after_window_end(self) -> None:
        existing: list[dict] = []
        scraped = [show("2028-01-01", artists="Too Far")]
        merged = u.merge_shows(existing, scraped, date(2026, 9, 14), date(2027, 12, 31))
        self.assertEqual(merged, [])

    def test_failure_normalize_rejects_invalid_date(self) -> None:
        self.assertIsNone(u.normalize_show(show("May 26, 2027")))
        self.assertIsNone(u.normalize_show({"date": "2027-05-26", "venue": "", "artists": ""}))


if __name__ == "__main__":
    unittest.main()
