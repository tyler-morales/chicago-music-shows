# TODOs

| Status | Item |
|--------|------|
| Done | Multi-select venue filter (OR across selected venues; empty = all) |
| Done | Date from/to still AND with the venue set |
| Done | Reset clears venue selection and restores date defaults |
| Done | Native `<select multiple>` + usage hint (Cmd/Ctrl / tap) |
| Done | Unit tests for filter success/failure (`node tests/filter.test.js`) |
| — | Refactor / deleted: removed single-select “All venues” option; empty selection is the all-venues state |

## Next

- Optional: remember last venue set in `location.hash` or `sessionStorage`
- Optional: “Select none / all” shortcut if the venue list grows painful
