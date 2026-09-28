# Deceased contract presence and saved continuation

A fresh paid opening exposed a save rejection after a casualty's contract expired.
The service roster removed the deceased character, but its presence record still
claimed recruited service. The resulting inconsistency rejected a later active
save. Explicitly dismissing a confirmed casualty had the same problem.

Presence synchronization now updates the service membership of dead characters
without invoking a living release transition. Life, health, location, death time,
retained scene and successor history are unchanged. A narrow save repair clears
only the stale recruited bit for an already confirmed dead, zero-health character
with no placement, no current service membership and no remaining contract.
Invalid life, health and placement data remain rejected.

## Verification

Runtime source: `c42397154c346166a35c168bd2143acc669f7062`.
Merged through [PR #58](https://github.com/fsodano/granaderos/pull/58);
[exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36390970281/job/108826469296) passed.

- `tests/contract-casualty-presence.test.mjs`: real seed-8 paid hires, arrival,
  Buenos Aires combat, actual casualty and saved victory settlement. Its actual
  contract expires, the resulting save reloads and another paid hire arrives.
  Dismissal also preserves the death and retained scene. Legacy stale-bit repair
  retains zero health and rejects forged life, health or placement values.
- All three new cases failed before the fix with the same appearance error.
  Thirty-five focused presence, local-contract, chapter and cast cases passed
  afterward. The actual rejected development checkpoint also reloads after repair.
- [Continuation evidence](../evidence/paid-continuation-2026-09-28.json) records the
  paid prefix and follow-ups. An economical fresh opening lost Buenos Aires.
  The existing stronger opening won, but Dorrego and Paroissien died. A probe that
  assumed those contacts could still join was corrected to respect their deaths.
- Continuing without renewal correctly expires all original day contracts and
  cancels the next approach; a controller must handle the absence of a pending
  battle. A separate paid relief continuation renews surviving affordable actors,
  receives four new week hires, and saves its next real combat after the repair.
  It loses San Nicolás with actual casualties and routing. This does not establish
  that the sector is unwinnable, and the full campaign remains unaccepted.

Release checks: **782/782 tests**, zero failures or skips (189,065 ms); type
check; production export (721 files, 631 asset references); 36 baseline checks;
documentation audit (197 requirements, all 50 original and 87 parity rows,
35 evidence records); 93 changed local links. Exact-head GitHub checks are
required before merge.

## Separate reproduced reentry defect

The real capital snapshot retained one player corpse and two enemy corpses.
Peaceful reentry discarded all three military bodies while retaining the two
civilian bodies. The campaign casualty remained permanently dead. The contract
fix does not change scene reentry or claim military-body persistence through it.
BODY-01 tracks this separate defect. Its later correction and regression scope
are recorded in [military body persistence](military-remains.md).

The larger local care, recapture, prisoner-rescue and performance gaps remain
open. No full campaign or live-browser acceptance is claimed.
