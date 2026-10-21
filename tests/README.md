# Minimal test set

This is the temporary test baseline requested on 2026-10-21. Run `npm test`
after installing the browser dependencies with `npm ci --prefix web`.
`npm run test:quick` is an alias for the same command. Both use two workers.

The 12 files cover campaign creation and contracts, travel, tactical orders,
finite inventory, battle settlement, worker execution, save validation,
autosave, public combat information, personnel controls and deployment paths.
They do not reconstruct artwork or simulate a complete campaign.

The previous large suite and its runner configuration were removed from the
current tree. They remain in Git at
`fc584dd4878be2b777c6ce1aa7c7f28f07e80d69` (tag `0.1.27`). Historical test
receipts still describe that earlier source; they are not current coverage.

Keep this set small. Add a check only when it protects essential behavior
that the existing tests do not cover. A broader testing strategy is deferred
until the owner chooses it. A passing minimum does not certify a full
campaign playthrough or visual quality.
