# Campaign start, movement and performance — 27 September 2026

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](published-progress.md) for the main branch baseline.

Full gameplay and universal 60 FPS acceptance remain open. This work preserves
the separate story-editor work and uses the real campaign screen for browser
checks.

## Starting with one person

The first living hired or created combatant starts the campaign. There is no
300-peso regiment-funding step and no additional horses, muskets or textiles
charge. The old `academy` command remains compatible and cannot grant duplicate
rewards. An empty roster cannot start. Hiring still pays the quoted contract.

A fresh production campaign was created through the UI with 3,200 pesos. Hiring
Baltasar Acosta for one day cost 10 pesos; the campaign advanced immediately and
entered Retiro with one person and 3,190 pesos. The free custom-character path
also has a zero-treasury regression check.

## Exploration endurance

Ordinary walking costs 0.05 energy per light-load grass tile, down from 0.25.
Crouched movement costs 0.25, down from 0.75. Running, crawling, combat movement,
climbing, load and terrain multipliers, wounds and fatigue limits remain active.
No health or energy is granted by changing these costs.

Checks cover 1,000 walking tiles with 50 energy left, 200 crouched tiles with 50
left, and a tired arrival walking 400 tiles from 46 to 26 energy. Save/reload,
split orders, mud, diagonals, failed moves and actual exhaustion are included.
The live QA character was crouched when the reported long walk exhausted him;
ordinary rest recovered him before further testing.

## Map scrolling

The mouse wheel and trackpad pan the tactical map on both axes. Shift+wheel pans
horizontally. Pixel, line and page input scale with zoom; fractional trackpad
movement accumulates and each frame applies one combined update. Panning stays
inside the map and stops camera follow until Center or a merc portrait is pressed.
Trackpad pinch (Ctrl+wheel) and two-finger touch pinch zoom smoothly around the
gesture position. Cmd+wheel retains browser behavior. Leaving the screen cancels
queued input. Clicking an already selected merc also centers the camera.

Native browser scrolling was checked in an existing Buenos Aires QA campaign
at 200% zoom. Vertical input changed camera translation from (-1166, -746) to
(-1166, -1106); horizontal input then changed it to (-1806, -1106). The document
remained at scrollY 0. Center returned to the selected character. Mounted tests
also cover all zoom levels, input modes, bounds, cleanup and unchanged gameplay.

## Changing a route during movement

Individual map movement commits one reached tile at a time. A new click replaces
all unexecuted steps. The current paid tile finishes; no previous movement is
rolled back and no abandoned route consumes energy. Triple-click changes the
remaining route to running. Esc discards the remainder. Group movement retains
its existing executor.

The worker plans the route once and validates each next step against the current
terrain, occupancy, action points, posture and interrupts. Walking animation
keeps its gait clock across tile boundaries. The worker prepares one future step
during the current animation, then commits only at its endpoint. Redirect,
cancel and unmount discard that unused result. Engine comparisons cover all gaits,
postures, diagonals, mud, combat, exploration and preserving facing. Mounted UI
tests exercise real map input while a tile is still animating.

A production browser check redirected Acosta from AO55 toward AO42, then AQ44
while walking. He finished at AQ44 with 55.51 energy from 56.1. A native triple
click then ran 12 tiles to AQ56, using the normal 18 energy.

## Campaign performance changes

- Save encoding runs in a worker. Pending saves coalesce; stale replies cannot
  replace newer saves. Hiding the page flushes the latest pair. Returning from
  the title uses the current campaign even if browser storage has failed.
- Consecutive tactical clock updates within the same hour reuse validated
  campaign state. Hour changes, new receipts and new/imported references use
  the full update. On a late checkpoint with six saved sectors and 20 units,
  40 updates matched the full result exactly; median time fell from 19.31 ms
  to 0.059 ms. Medical, escort and mount reconciliation still runs.
- Stable HUD models and sprite atlas content are reused during interpolation.
  Camera motion changes one scene transform, with matching pointer conversion.
- Static layers read their bounds together and publish prepared images in
  batches. This avoids repeatedly repainting the remaining filtered vectors.
- Moves, climbs, charges and grouped/compound moves record the cells actually
  reached. Animation reuses that path instead of repeating the search on the
  main thread. Preparation time no longer advances the new animation clock.
- Motion publishes at most 60 regular React position updates per second on
  high-refresh displays. Position still uses the real animation timestamp;
  delayed frames do not cause catch-up bursts, and completion is immediate.
  Mounted tests cover 60/120 Hz, timestamp jitter and a delayed frame.
- The real campaign has an opt-in 6- or 20-second frame measurement control at
  `?qa=1&performance=1`. It reports movement separately from idle frames and
  includes the starting/ending party and raster work. QA saves use a separate
  storage key.

## Browser evidence

Measurements use the in-app browser, one hired character in the actual Retiro
campaign, and 100% zoom. No browser tree or screenshot capture runs during a
sample. These are local observations, not a guarantee for every device or map.

| Check | Observation |
| --- | --- |
| Cold scenery before batched publication, development build | 31 cached layers in six seconds; repeated roughly 125 ms paints; maximum frame 184 ms |
| Cold scenery after batched publication, development build | All 204 layers in six seconds; repeated pauses gone; maximum frame 175 ms; initial sector-entry work still present |
| Production, 42-tile walk, fixed camera | 1,211 moving frames, 8.34 ms mean, 8.8 ms p95, 16.7 ms maximum; no moving frame above 16.8 ms |
| Production, 42-tile return, following camera | 1,210 moving frames, 8.33 ms mean, 8.7 ms p95, 9.3 ms maximum; no moving frame above 16.8 ms |
| Production after recorded-route reuse, 42 tiles, following camera | 1,211 moving frames, 8.33 ms mean, 9.3 ms p95, 10.3 ms maximum; no moving frame above 16.8 ms and no long tasks |

These 42-tile measurements precede incremental movement and are historical
comparisons, not acceptance of the final movement controller. The first two
production samples also precede recorded-route reuse. They include
90–99 ms tasks before animation starts; the subsequent sample has no long tasks.
The updated walk uses 2.1 energy and arrives conscious. The earlier development long-route
sample was crouched and ended in exhaustion, so it is not an equivalent
walking comparison. Loaded-scene results do not establish cold-load or combat
performance.

The final production controller was then measured on a new 42-tile walk from
AQ55 to AQ13 with camera follow: 1,261 moving frames, 8.33 ms mean, 9.6 ms p95,
10.4 ms maximum, and no moving frame above 16.8 ms. There were no long tasks or
browser errors. Energy fell from 37.46 to 35.36; the character remained conscious.
Rendered position updates are capped separately: 601 updates, 17.46 ms mean,
25 ms p95 and 33.4 ms maximum. Thus browser frame cadence is not a claim that
every position update occurs within 16.8 ms.

An immediate reload during another long walk restored the first paid cell and
its 0.05 energy cost, without saving the abandoned remainder as completed.

See [measurement evidence](../evidence/campaign-performance-2026-09-27.json).

## Campaign progression and remaining failures

Before the endurance change, the paid fresh route passed Mendoza, foundry
production, the 3,000-person army, Uspallata and survivor recovery. The next Los
Patos attempt lost in turn five. Those are checkpoint results from before the
latest timing and movement changes, not a current full-route pass.

The latest integrated run instead stops during Córdoba recovery when a real
roaming enemy group arrives at hour 150. The established Córdoba defense and
physical prisoner-rescue route also remain unresolved. Normal withdrawal, paid
transport and rest improve rescue arrival energy but do not make the tested
controllers win or evacuate prisoners. No victory was injected.
See [route evidence](../evidence/campaign-progress-2026-09-27.json).

The intermediate integrated run had 2,858 tests: 2,847 passed, eight failed and
three skipped. Three failures were old exhaustion-boundary fixtures, corrected
for the new energy rate without changing collapse behavior. The capital route
also exposed a finite clothing preparation gap. Final validation follows below.

## Final checks

- 110 focused tests passed, including engine/worker costs, mid-step redirects,
  discarded prepared steps, triple-click, mounted camera inputs, save lifecycle,
  campaign start, endurance and campaign clock equivalence.
- Typecheck and the production build passed. The static export verified 962
  files and 858 asset references.
- The broad run had 2,901 tests: 2,893 passed, five failed and three skipped.
  One failure came from a portrait test loaded during the final precompute
  adjustment. The corrected test passes in the final focused run. The remaining
  failures are the three campaign scenarios described above plus one parent
  test failure. This is not a full-suite pass.
- Capital clothing preparation now transfers an existing support veteran's
  poncho through ordinary sector inventory commands. No clothing is created;
  the exact garment, stock and paid-contract assertions pass.
