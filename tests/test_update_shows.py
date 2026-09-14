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


class SongkickParseTests(unittest.TestCase):
    def test_success_json_ld_keeps_2027_music_event(self) -> None:
        html = """
        <script type="application/ld+json">
        {"@type":"MusicEvent","startDate":"2027-05-26T19:30",
         "name":"The Airborne Toxic Event",
         "location":{"name":"The Vic",
           "address":{"streetAddress":"3145 N Sheffield Ave",
             "addressLocality":"Chicago","addressRegion":"IL","postalCode":"60657"}},
         "url":"https://www.songkick.com/concerts/1"}
        </script>
        """
        parsed = u.parse_songkick_html(html)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]["date"], "2027-05-26")
        self.assertEqual(parsed[0]["venue"], "The Vic")
        self.assertEqual(parsed[0]["artists"], "The Airborne Toxic Event")

    def test_success_listed_pages_reads_calendar_query(self) -> None:
        html = (
            '<a href="/metro-areas/9426-us-chicago/calendar?page=2#metro-area-calendar">2</a>'
            '<a href="/metro-areas/9426-us-chicago/calendar?page=21#metro-area-calendar">21</a>'
        )
        self.assertEqual(u.songkick_listed_pages(html), [2, 21])

    def test_failure_ignores_non_event_json_ld(self) -> None:
        html = """
        <script type="application/ld+json">
        {"@type":"Organization","name":"Songkick","url":"https://www.songkick.com"}
        </script>
        """
        self.assertEqual(u.parse_songkick_html(html), [])

    def test_failure_listed_pages_empty_without_calendar_links(self) -> None:
        self.assertEqual(u.songkick_listed_pages("<html><a href='/concerts/1'>x</a></html>"), [])


if __name__ == "__main__":
    unittest.main()
