# TODOs

| Status | Item |
|--------|------|
| Done | Multi-select venue filter (OR across selected venues; empty = all) |
| Done | Date from/to still AND with the venue set |
| Done | Reset clears venue selection and restores date defaults |
| Done | Native `<select multiple>` + usage hint (Cmd/Ctrl / tap) |
| Done | Unit tests for filter success/failure (`node tests/filter.test.js`) |
| Done | Per-show favorites (★/☆) on table rows and mobile cards |
| Done | Persist favorites in localStorage with date+venue+artists+ticket_url key |
| Done | Favorites-only toggle ANDs with venue multi-select and date filters |
| Done | Reset turns off Favorites only; does not wipe saved stars |
| Done | Artist thumbnails (iTunes Search artwork, Wikipedia fallback) |
| Done | Lazy-load thumbs + bounded localStorage cache (max 200) |
| Done | Artist names link to Spotify search (new tab, noopener noreferrer) |
| Done | Multi-artist bills: each name is its own link (` / ` or comma, same as thumbs) |
| Done | No Spotify Client Secret in the frontend; search URLs only |
| — | Refactor: `primaryArtist` now uses shared `splitArtists` |

## Next

- Optional: remember last venue set in `location.hash` or `sessionStorage`
- Optional: “Select none / all” shortcut if the venue list grows painful
- Optional: serverless Spotify Web API lookup for canonical artist profile URLs (needs a secret, not for this static site)
