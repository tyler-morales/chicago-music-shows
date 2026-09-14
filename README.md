# Chicago Music Shows (static site)

Bare-bones static listing of upcoming Chicago music shows, filterable by venue (multi-select), date, and starred favorites. Data comes from a best-effort scrape of public aggregators (similar to concerts50 / bandsintown / songkick). **Coverage is incomplete** and not authoritative.

## Using the filters

- **Venues:** native multi-select. Click (or tap) a venue to select it; hold **Cmd** (Mac) or **Ctrl** (Windows) to add more. On many phones, tap additional rows to include them. Leave the list empty to show **all venues**.
- **From / To:** inclusive date range. From defaults to today; To is optional.
- Venue set and date range combine with **AND**. Multiple venues combine with **OR** (a show matches if its venue is any of the selected ones).
- **Reset** clears the venue selection (back to all), turns off Favorites only, and restores the date defaults. Saved stars are kept.

## Favorites

- Click **☆** on a row or card to star a show (**★**). Click again to unstar.
- Stars are stored in this browser (`localStorage`); there is no account.
- Identity is `date + venue + artists + ticket_url`, so the same listing stays starred after a data refresh.
- Check **Favorites only** to list starred shows. That filter still **AND**s with the venue multi-select and date range.

## Artist images

Small thumbnails next to the artist name (table + mobile cards). Looked up in the browser, not stored in `data/shows.json`:

1. **Apple iTunes Search API** album artwork for the first billed artist (` / ` or comma split).
2. If that misses, **Wikipedia** page-summary thumbnail.
3. If both miss or the image 404s, the row stays a letter placeholder.

Images lazy-load when a row/card is near the viewport. Successful (and failed) lookups are cached in `localStorage` (max 200 artists) so scrolling and reloads do not refetch everything.

## Spotify links

Artist names in the table and on mobile cards are links. Each name opens Spotify search in a new tab (`rel="noopener noreferrer"`):

`https://open.spotify.com/search/<urlencoded artist>`

Multi-artist bills use the same split as first-billed thumbnails: ` / ` or comma, and each name is its own link.

No Spotify login and no API keys. The Web API needs a Client Secret, so this static GitHub Pages site does not call it from the browser. Search URLs are the baseline; they land on Spotify’s search results for that name (usually the artist is the top hit).

## Local preview

Open `index.html` via a local static server (fetch needs HTTP, not `file://`):

```bash
cd chicago-music-shows-site
python3 -m http.server 8080
```

Then visit http://localhost:8080/

## Live site

**https://tyler-morales.github.io/chicago-music-shows/**

## GitHub Pages setup

This repo is configured to publish from the `main` branch root (or via the `pages.yml` GitHub Actions workflow if Actions-based Pages is used).

1. In the repo: **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch** (branch `main`, folder `/`), **or** **GitHub Actions** if using `.github/workflows/pages.yml`.
3. After the first deploy, the site is at https://tyler-morales.github.io/chicago-music-shows/

No build step is required for branch-based Pages — it serves the HTML/CSS/JS/JSON as static files.

If the repo is private, enable Pages according to your plan; public repos work on the free tier.

## Daily data update

Workflow: `.github/workflows/update-shows.yml`

- Runs on a daily cron (`15 12 * * *` UTC) and on **workflow_dispatch** (manual).
- Runs `scripts/update_shows.py`, which refreshes `data/shows.json` for dates from **today** through **2026-12-31** (or +90 days past year-end when near Dec 31).
- Uses only the Python standard library.
- On network/parse failure: **leaves existing data**, writes a note into `data/meta.json`, and **exits 0**.
- If JSON files change, the workflow commits and pushes with `permissions: contents: write`.

### Manual run

```bash
python3 scripts/update_shows.py
```

### Notes on the scraper

- Best-effort / incomplete: aggregator HTML and protections change often.
- Do not treat the list as complete or official.
- Existing `data/shows.json` seeded content is preserved/merged when scrapes partially succeed.

## Files

| Path | Role |
|------|------|
| `index.html` | Page shell |
| `filter.js` | Pure venue/date/favorites filter helpers (browser + Node tests) |
| `artist-art.js` | Artist split + Spotify search URLs + iTunes/Wikipedia artwork helpers |
| `app.js` | Load JSON, wire filters + favorites + lazy artist thumbs + Spotify name links |
| `tests/filter.test.js` | Venue/date filter tests (`node tests/filter.test.js`) |
| `tests/favorites.test.js` | Favorite key/storage/filter tests (`node tests/favorites.test.js`) |
| `tests/artist-art.test.js` | Artist parse/artwork/cache tests (`node tests/artist-art.test.js`) |
| `styles.css` | Minimal responsive layout only |
| `data/shows.json` | Show records |
| `data/meta.json` | `last_updated` timestamp + notes |
| `scripts/update_shows.py` | Daily refresh script |
| `.github/workflows/update-shows.yml` | Cron + manual update |
| `.github/workflows/pages.yml` | Deploy static site to GitHub Pages |

## Show record fields

`date`, `doors_or_time`, `venue`, `venue_address`, `artists`, `ticket_url`, `source`, `notes`
