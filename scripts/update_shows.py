#!/usr/bin/env python3
"""
Best-effort scraper to refresh Chicago music show listings.

This script attempts to pull upcoming Chicago shows from public aggregator-style
sources when reachable. Coverage is incomplete and opportunistic — sites change
HTML/APIs, block scrapers, or rate-limit. On any network/parse failure, existing
data/shows.json is left unchanged and the process exits 0 with a note.

Output:
  data/shows.json  — list of show objects
  data/meta.json   — last_updated, show_count, note

Date window: from today through 2026-12-31, or if today is after ~Oct 1 of a
year and we are near year-end, extend +90 days past year end (for now the
explicit end is 2026-12-31 as requested).
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SHOWS_PATH = DATA_DIR / "shows.json"
META_PATH = DATA_DIR / "meta.json"

USER_AGENT = (
    "ChicagoMusicShowsBot/1.0 (+https://github.com/; best-effort public listing refresh; "
    "contact: local-static-site)"
)
TIMEOUT = 25


def log(msg: str) -> None:
    print(msg, flush=True)


def end_date_for_window(today: date) -> date:
    """Through end of year, or +90 days if within ~90 days of year end."""
    year_end = date(today.year, 12, 31)
    if (year_end - today).days <= 90:
        return today + timedelta(days=90)
    # Project requirement: for now through 2026-12-31
    return max(year_end, date(2026, 12, 31))


def http_get(url: str) -> str | None:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/json,*/*",
            "Accept-Language": "en-US,en;q=0.9",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            charset = resp.headers.get_content_charset() or "utf-8"
            return resp.read().decode(charset, errors="replace")
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as e:
        log(f"  GET failed {url}: {e}")
        return None


def load_existing() -> list[dict[str, Any]]:
    if not SHOWS_PATH.exists():
        return []
    try:
        data = json.loads(SHOWS_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError) as e:
        log(f"Could not read existing shows.json: {e}")
        return []


def normalize_show(raw: dict[str, Any]) -> dict[str, Any] | None:
    d = (raw.get("date") or "").strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", d):
        return None
    venue = (raw.get("venue") or "").strip()
    artists = (raw.get("artists") or "").strip()
    if not venue and not artists:
        return None
    return {
        "date": d,
        "doors_or_time": (raw.get("doors_or_time") or "").strip(),
        "venue": venue,
        "venue_address": (raw.get("venue_address") or "").strip(),
        "artists": artists,
        "ticket_url": (raw.get("ticket_url") or "").strip(),
        "source": (raw.get("source") or "").strip(),
        "notes": (raw.get("notes") or "").strip(),
    }


def show_key(s: dict[str, Any]) -> tuple:
    return (
        s.get("date", ""),
        s.get("doors_or_time", ""),
        s.get("venue", "").lower(),
        s.get("artists", "").lower(),
        s.get("ticket_url", ""),
    )


def merge_shows(existing: list[dict[str, Any]], new: list[dict[str, Any]],
                start: date, end: date) -> list[dict[str, Any]]:
    """Keep shows outside window from existing; replace/merge inside window with new+existing."""
    kept_outside: list[dict[str, Any]] = []
    inside_map: dict[tuple, dict[str, Any]] = {}

    start_s, end_s = start.isoformat(), end.isoformat()

    for s in existing:
        n = normalize_show(s)
        if not n:
            continue
        if n["date"] < start_s or n["date"] > end_s:
            kept_outside.append(n)
        else:
            inside_map[show_key(n)] = n

    for s in new:
        n = normalize_show(s)
        if not n:
            continue
        if n["date"] < start_s or n["date"] > end_s:
            continue
        k = show_key(n)
        if k in inside_map:
            # Prefer richer fields
            old = inside_map[k]
            for field in ("ticket_url", "venue_address", "doors_or_time", "notes", "source"):
                if not old.get(field) and n.get(field):
                    old[field] = n[field]
                elif field == "source" and n.get("source") and n["source"] not in (old.get("source") or ""):
                    old["source"] = "; ".join(
                        x for x in [old.get("source", ""), n["source"]] if x
                    )
            inside_map[k] = old
        else:
            inside_map[k] = n

    combined = kept_outside + list(inside_map.values())
    combined.sort(key=lambda x: (x.get("date", ""), x.get("doors_or_time", ""), x.get("venue", ""), x.get("artists", "")))
    return combined


# --- Source parsers (best-effort, fragile) ---

def parse_iso_from_text(text: str) -> str | None:
    m = re.search(r"(\d{4}-\d{2}-\d{2})", text)
    return m.group(1) if m else None


def scrape_concerts50() -> list[dict[str, Any]]:
    """Try concerts50 Chicago listings pages."""
    shows: list[dict[str, Any]] = []
    urls = [
        "https://concerts50.com/chicago-concerts",
        "https://www.concerts50.com/chicago-concerts",
        "https://concerts50.com/il/chicago",
    ]
    for url in urls:
        log(f"Trying concerts50: {url}")
        html = http_get(url)
        if not html:
            continue
        # Very loose patterns: event cards / links with dates
        # Match show links and nearby date/venue/artist text
        for m in re.finditer(
            r'href="(https?://(?:www\.)?concerts50\.com/show/[^"]+)"[^>]*>([^<]{3,120})',
            html,
            re.I,
        ):
            ticket_url, label = m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()
            # Look ahead in a window for a date
            start = m.start()
            window = html[max(0, start - 400) : start + 800]
            d = parse_iso_from_text(window)
            if not d:
                # Try Month Day, Year
                dm = re.search(
                    r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
                    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|"
                    r"Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})",
                    window,
                    re.I,
                )
                if dm:
                    try:
                        d = datetime.strptime(
                            f"{dm.group(1)[:3]} {dm.group(2)} {dm.group(3)}", "%b %d %Y"
                        ).date().isoformat()
                    except ValueError:
                        d = None
            if not d:
                continue
            venue_m = re.search(
                r"(?:at|@)\s+([A-Z][^<\n|]{2,60})", label
            ) or re.search(
                r"Venue[:\s]+([^<\n]{2,80})", window, re.I
            )
            venue = venue_m.group(1).strip() if venue_m else ""
            artists = label
            if venue and " at " in label.lower():
                parts = re.split(r"\s+at\s+", label, maxsplit=1, flags=re.I)
                if len(parts) == 2:
                    artists, venue = parts[0].strip(), parts[1].strip()
            shows.append(
                {
                    "date": d,
                    "doors_or_time": "",
                    "venue": venue or "Chicago",
                    "venue_address": "",
                    "artists": artists,
                    "ticket_url": ticket_url,
                    "source": "concerts50",
                    "notes": "",
                }
            )
        if shows:
            log(f"  concerts50 parsed ~{len(shows)} candidates")
            break
        time.sleep(1)
    return shows


def scrape_songkick_metro() -> list[dict[str, Any]]:
    """Songkick metro Chicago page (HTML scrape)."""
    shows: list[dict[str, Any]] = []
    urls = [
        "https://www.songkick.com/metro-areas/9426-us-chicago/calendar",
        "https://www.songkick.com/metro-areas/9426-us-chicago",
    ]
    for url in urls:
        log(f"Trying songkick: {url}")
        html = http_get(url)
        if not html:
            continue
        # microformat / event listings
        for m in re.finditer(
            r'<time[^>]*datetime="(\d{4}-\d{2}-\d{2})[^"]*"[^>]*>.*?'
            r'(?:artists?\s*strong[^>]*>|class="[^"]*artists?[^"]*"[^>]*>)\s*([^<]{2,120})',
            html,
            re.I | re.S,
        ):
            d, artists = m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()
            window = html[m.start() : m.start() + 1200]
            venue_m = re.search(
                r'class="[^"]*venue[^"]*"[^>]*>\s*<[^>]+>\s*([^<]{2,80})',
                window,
                re.I,
            ) or re.search(r'venue[^\n]{0,40}>\s*([^<]{2,80})', window, re.I)
            venue = venue_m.group(1).strip() if venue_m else ""
            link_m = re.search(r'href="(/concerts/\d+[^"]*)"', window)
            ticket_url = (
                "https://www.songkick.com" + link_m.group(1) if link_m else ""
            )
            shows.append(
                {
                    "date": d,
                    "doors_or_time": "",
                    "venue": venue,
                    "venue_address": "",
                    "artists": artists,
                    "ticket_url": ticket_url,
                    "source": "songkick",
                    "notes": "",
                }
            )
        # Fallback: JSON-LD
        for m in re.finditer(
            r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
            html,
            re.I | re.S,
        ):
            try:
                payload = json.loads(m.group(1))
            except json.JSONDecodeError:
                continue
            items = payload if isinstance(payload, list) else [payload]
            for item in items:
                if not isinstance(item, dict):
                    continue
                graph = item.get("@graph")
                if isinstance(graph, list):
                    items.extend(graph)
                if item.get("@type") not in ("MusicEvent", "Event", ["MusicEvent"], ["Event"]):
                    t = item.get("@type")
                    if t not in ("MusicEvent", "Event") and t != ["MusicEvent"]:
                        continue
                start = (item.get("startDate") or "")[:10]
                if not re.match(r"^\d{4}-\d{2}-\d{2}$", start):
                    continue
                name = item.get("name") or ""
                loc = item.get("location") or {}
                if isinstance(loc, list) and loc:
                    loc = loc[0]
                venue = ""
                addr = ""
                if isinstance(loc, dict):
                    venue = loc.get("name") or ""
                    a = loc.get("address") or {}
                    if isinstance(a, dict):
                        addr = ", ".join(
                            x for x in [
                                a.get("streetAddress"),
                                a.get("addressLocality"),
                                a.get("addressRegion"),
                                a.get("postalCode"),
                            ]
                            if x
                        )
                url = item.get("url") or ""
                shows.append(
                    {
                        "date": start,
                        "doors_or_time": (item.get("startDate") or "")[11:16],
                        "venue": venue,
                        "venue_address": addr,
                        "artists": name,
                        "ticket_url": url if isinstance(url, str) else "",
                        "source": "songkick",
                        "notes": "",
                    }
                )
        if shows:
            log(f"  songkick parsed ~{len(shows)} candidates")
            break
        time.sleep(1)
    return shows


def scrape_bandsintown_search() -> list[dict[str, Any]]:
    """Bandsintown city search page (HTML)."""
    shows: list[dict[str, Any]] = []
    urls = [
        "https://www.bandsintown.com/c/chicago-il",
        "https://www.bandsintown.com/choose-dates/upcoming-events-in-chicago-il",
    ]
    for url in urls:
        log(f"Trying bandsintown: {url}")
        html = http_get(url)
        if not html:
            continue
        for m in re.finditer(
            r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
            html,
            re.I | re.S,
        ):
            try:
                payload = json.loads(m.group(1))
            except json.JSONDecodeError:
                continue
            items = payload if isinstance(payload, list) else [payload]
            stack = list(items)
            while stack:
                item = stack.pop()
                if isinstance(item, list):
                    stack.extend(item)
                    continue
                if not isinstance(item, dict):
                    continue
                if "@graph" in item and isinstance(item["@graph"], list):
                    stack.extend(item["@graph"])
                t = item.get("@type")
                types = t if isinstance(t, list) else [t]
                if not any(x in ("MusicEvent", "Event") for x in types if x):
                    continue
                start = (item.get("startDate") or "")[:10]
                if not re.match(r"^\d{4}-\d{2}-\d{2}$", start):
                    continue
                loc = item.get("location") or {}
                if isinstance(loc, list) and loc:
                    loc = loc[0]
                venue = loc.get("name", "") if isinstance(loc, dict) else ""
                addr = ""
                if isinstance(loc, dict):
                    a = loc.get("address") or {}
                    if isinstance(a, str):
                        addr = a
                    elif isinstance(a, dict):
                        addr = ", ".join(
                            x for x in [
                                a.get("streetAddress"),
                                a.get("addressLocality"),
                                a.get("addressRegion"),
                                a.get("postalCode"),
                            ]
                            if x
                        )
                performers = item.get("performer") or item.get("name") or ""
                if isinstance(performers, list):
                    artists = " / ".join(
                        p.get("name", "") if isinstance(p, dict) else str(p)
                        for p in performers
                    )
                elif isinstance(performers, dict):
                    artists = performers.get("name", "")
                else:
                    artists = str(performers)
                ticket_url = item.get("url") or ""
                if isinstance(ticket_url, list):
                    ticket_url = ticket_url[0] if ticket_url else ""
                shows.append(
                    {
                        "date": start,
                        "doors_or_time": (item.get("startDate") or "")[11:16],
                        "venue": venue or "",
                        "venue_address": addr,
                        "artists": artists,
                        "ticket_url": ticket_url if isinstance(ticket_url, str) else "",
                        "source": "bandsintown",
                        "notes": "",
                    }
                )
        if shows:
            log(f"  bandsintown parsed ~{len(shows)} candidates")
            break
        time.sleep(1)
    return shows


def write_meta(count: int, note: str) -> None:
    META_PATH.parent.mkdir(parents=True, exist_ok=True)
    meta = {
        "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "show_count": count,
        "note": note,
    }
    META_PATH.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    today = date.today()
    end = end_date_for_window(today)
    # Explicit project window: through 2026-12-31 at minimum
    end = max(end, date(2026, 12, 31))
    log(f"Update window: {today.isoformat()} .. {end.isoformat()}")

    existing = load_existing()
    log(f"Existing shows: {len(existing)}")

    scraped: list[dict[str, Any]] = []
    errors = 0
    for name, fn in (
        ("concerts50", scrape_concerts50),
        ("songkick", scrape_songkick_metro),
        ("bandsintown", scrape_bandsintown_search),
    ):
        try:
            batch = fn()
            log(f"{name}: {len(batch)} raw")
            scraped.extend(batch)
        except Exception as e:  # noqa: BLE001 — best-effort scraper
            errors += 1
            log(f"{name} raised: {e}")

    if not scraped:
        note = (
            "Scrape returned no new events (network blocked, markup changed, or empty). "
            "Left existing data/shows.json unchanged."
        )
        log(note)
        # Still bump meta timestamp so footer shows last attempt? Spec: leave data, exit 0 with note.
        # Update meta to record attempt without changing shows.
        write_meta(len(existing), note)
        return 0

    merged = merge_shows(existing, scraped, today, end)
    # Drop past shows before today from file to keep lean (optional but useful)
    start_s = today.isoformat()
    merged = [s for s in merged if (s.get("date") or "") >= start_s]

    note = (
        "Best-effort incomplete aggregator scrape; not exhaustive. "
        f"Merged {len(scraped)} scraped candidates into {len(merged)} shows "
        f"(window {today.isoformat()}–{end.isoformat()}; parse_errors={errors})."
    )

    SHOWS_PATH.write_text(
        json.dumps(merged, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    write_meta(len(merged), note)
    log(note)
    log(f"Wrote {SHOWS_PATH} ({len(merged)} shows)")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:  # noqa: BLE001
        # Never fail the workflow hard — leave data, exit 0
        log(f"Fatal error (exiting 0 to keep existing data): {e}")
        try:
            existing = load_existing()
            write_meta(
                len(existing),
                f"Update failed; left existing data. Error: {e}",
            )
        except Exception:  # noqa: BLE001
            pass
        raise SystemExit(0)
