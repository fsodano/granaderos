# Automatic quest deadlines

An authored quest can have an optional limit of 1–720 campaign hours. It starts
at actual acceptance, including the second within the hour. Tactical actions,
strategic waiting and travel advance the same clock. An overdue active quest
fails once; a quest completed before the deadline keeps its result.

## Behavior

The editor supports a blank unlimited deadline and preserves the configured limit
through undo/redo, copy, recovery and launch. The conversation shows a timed
quest's limit before acceptance. The campaign journal displays remaining minutes,
the due day/time and a failure reason after expiration. Unstarted quests have no
running timer.

Accepted quest events record their precise campaign time. Older untimed events
without a second field remain readable. Successful campaign actions process due
quests in deadline order, even when a long wait crosses several limits. Each
automatic failure records its scheduled deadline and time. Save admission checks
that deadline against the pinned definition and acceptance event, rejects overdue
active state without an expiry, and rejects altered or inconsistent chronology.
Automatic failure has no dialogue/payment receipt because no player choice or
treasury transaction occurred.

## Evidence

Runtime source: `012a7bb0bf13431b396ddf749f6e9b94d95e6698`.
The complete local suite passed **652/652 tests**, without failures or skips.
Types, production export and all 36 baseline comparisons passed. The register
retains 180 requirements and 19 evidence records. Exact-head CI must pass before
merge.

- `tests/quest-deadlines.test.mjs`: acceptance at a nonzero campaign second,
  five real tactical rests with ten minutes remaining, save/reload and a sixth
  rest reaching the exact deadline; once-only failure and no later reward.
  Real cell travel and strategic waits also expire a quest. Multiple deadlines
  sort by due time, unstarted quests do not tick, early completion persists, and
  invalid definitions, precise clocks or missing/altered expiry evidence reject.
- `tests/story-editor.test.mjs`: mounted quest authoring adds a deadline, undoes
  and restores it, preserves it through copy and launches an actual accepted quest
  with the expected remaining hour.
- `tests/webmcp-campaign.test.mjs`: mounted conversation shows the hour limit;
  map controls reveal 60 minutes remaining; actual registered tactical rests
  expire the quest and synchronize the autosave; the journal shows its failure.

## Limits

DEADLINE-01 is a bounded delivery; STORY-03 remains partial. Deadlines fail active
quests and do not grant rewards. Death/escort policies, item objectives, historical
role overrides and scripted movement remain open. No complete campaign,
live-browser or performance acceptance is claimed.
