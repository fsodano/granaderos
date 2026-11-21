# Remaining implementation queue after 0.3.0-dev.1 (archived 2026-09-05)

> **Archived historical ledger.** This superseded record preserves the 2026-09-05 implementation queue recorded after the `0.3.0-dev.1` checkpoint (209 tests). Read
> published progress for current scope and [ja2-parity-audit.md](../verification/ja2-parity-audit.md) for current requirement status.

The full game implementation objective remained active at this checkpoint (limits: 209 passing tests did not satisfy full period equipment, naval missions, tactical formations, long-range fields or full browser acceptance). Check [REQUIREMENT-AUDIT.md](REQUIREMENT-AUDIT.md) and [`docs/specification/original.txt`](../specification/original.txt) before declaring completion. The `0.3.0-dev.1` checkpoint made real
implementation progress; it was not blocked by the earlier macOS screen lock that prevented automated screenshot capture.

## Tactical/strategic clock bridge

Keep campaign.hour integer for hourly production, payroll and raids. Add integer
secondOfHour (0..3599), default zero for old saves. Battles carry elapsedSeconds,
syncedSeconds and battle ID; synchronize only positive unsynced time through a
paired campaign/battle reducer. Exploration durations come from actual successful
movement/actions; combat uses a defined round duration and final partial-round
accounting. Failed orders and navigation consume no time.

Do not call existing tick blindly during combat: it removes contracted soldiers,
heals at midnight and runs raids against occupied sectors. Protect deployed
participants/mounts from strategic healing/removal, defer their contract departures
until the battle report, and queue raids against the occupied battlefield until
casualties are reconciled. Remote production/expiry may continue normally. Update
page.tsx campaign and battle state together and save a consistent pair. Night and
light aging must share the new time base (old code assumes ten-minute light turns).

Acceptance: fractional carry, invalid-order zero time, save idempotency, midnight,
deployed versus remote expiry, queued occupied-sector raids, horses, light aging,
and final-round duration.

## Authored mission scenes

Current Yatasto phase advances through strategic gates and has no playable
Belgrano encounter. San Lorenzo has a map but lacks allied San Martín. Introduce
registered mission scenes anchored to strategic sectors, separately persisted
scene snapshots, temporary mission allies (San Martín must never become hired
through the scene), staged objectives and validated results. Preserve existing
13 strategic-sector saves without pretending the scenes already exist.

Additional major requirements remain: full period equipment/inventory, industry
inputs and shipping, naval missions/boarding/privateering, tactical formations,
large enough fields to exercise supplied weapon ranges, comprehensive Spanish
and browser acceptance. These are not satisfied by the current test count.
