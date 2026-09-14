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
| — | Refactor / deleted: none this change (favorites reuse `filterShows`) |

## Next

- Optional: remember last venue set in `location.hash` or `sessionStorage`
- Optional: “Select none / all” shortcut if the venue list grows painful
