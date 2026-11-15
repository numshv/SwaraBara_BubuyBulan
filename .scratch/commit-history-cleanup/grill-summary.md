# Grill Summary: Commit history cleanup

## Situation
- 8 local commits (`v1 interface` … `v8: add CO data visualization`), no remote, never pushed. Rewriting history is safe.

## Decisions
- **Reword in place**: same 8 commits, same order, same code snapshots, author and dates; only messages change. Hashes change (message is part of the hash), which is fine before the first push.
- Rejected: squashing into one commit (loses the project's evolution); new folder/repo (no benefit, risk of missing files; only worth it if history contained secrets — it doesn't).
- Style: English, Conventional Commits. Messages checked against each commit's diff (`git show --stat`).
- A safety branch `backup/original-history` keeps the old history until the user deletes it.
- The uncommitted work (floating legend, El Niño/IOD legend entry) goes in as commit 9.

## New messages
| Old | New |
|---|---|
| v1 interface | feat: initial interactive mockup of the wildfire sonification |
| v2: add aerosol to map | feat: add MERRA-2 aerosol smoke layer to the map |
| v3: revisi contol | feat: add sound-layer meters with gamelan instruments and climate data |
| v4: dramatic fire | feat: add dramatic fire effects and simplify the narration panel |
| v5: revamp toggle | style: restyle sound-layer toggles with the project palette |
| v6: add el nino iod visualization | feat: visualise El Niño and IOD as ocean-edge glows |
| v7: updated to newest data shape | refactor: trim to five sound layers and let toggles hide map layers |
| v8: add CO data visualization | feat: add CO contour layer to the map |
| (new) | feat: float the legend and add an El Niño/IOD entry |

## Out of scope
- Adding a remote and pushing (needs the user's remote URL and go-ahead).
