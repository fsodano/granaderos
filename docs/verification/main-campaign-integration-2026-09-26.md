# Main campaign integration audit — 2026-09-26

This is an integration audit, not a claim that all requested features are complete.

## Verified campaign path

The root page imports `Battlefield` directly. Campaign sector entry uses
`prepareCampaignBattle`; accepted battle changes pass through `syncBattleTime`
and the normal save encoder. The `qa=1` query changes only the save key. It does
not select a different battle, inventory, art, or rules implementation.

The normal root page was tested with an existing campaign checkpoint through
**Importar partida**, on the production export at port 3002 and the development
server at port 3000. The user's ordinary save was not replaced.

- Both pages rendered illustrated character atlases and omitted the Órdenes menu.
- On the production root page, unloading the Baker changed its charge from 1 to
  0 and its reserve ammunition from 8 to 9. Reloading the page and continuing the
  campaign retained both values.
- A normal ground-cell order moved the selected soldier from AF44 to AF45.
  The journal recorded the movement; the browser reported no warnings or errors.

## Shared implementations

| Enhancement | Main campaign connection | Evidence / limit |
| --- | --- | --- |
| Longer walking endurance and faster recovery | Shared `game/tactical.js` rules | Focused walking/endurance tests; no fixture-only rule switch |
| Gun melee mode | Shared hotkey and tactical action modules | Existing control tests; not newly exercised through the root page in this audit |
| Ordinary pocket items and ammo unloading | `JA2Inventory`, `CampaignPockets`, equipment planners and campaign inventory dispatcher | Root-page unload/save/reload; campaign placement tests |
| Remove Órdenes | Shared `JA2Strip` | Root-page DOM and render tests |
| Illustrated sprites | `SpriteFigure` → `spriteRender` → illustrated atlas registry | Root-page images; does not prove equipment-specific artwork |
| Scene caching and visibility/aim optimizations | Shared `TacticalScene` and tactical rules | Used by the root campaign and performance fixture |
| Background movement and turn calculation | `Battlefield` → `useBattleExecutor` → `runBattleJob` | Worker equivalence tests and root-page movement; other action classes still run synchronously |

The performance fixture now calls the same background executor hook as the main
battle screen. Its previous direct `actBattle` call did not measure that path.
The production check then found a worker URL based on a local file path, which
silently invoked the synchronous fallback. This is fixed with a bundler worker
URL import and an export check. Uninterrupted 30-enemy movement had no frames
over 16.8 ms; reactions still exceeded the limit. See
`evidence/worker-frame-rate-2026-09-26.json`.

## Confirmed gaps

- `spriteEquipment` has classifier tests, but the runtime renderer does not use
  it. Approved equipment-specific atlases are missing. Knife, sword, pistol and
  empty-hand silhouettes are therefore **not complete**. Rejected preview art
  must not be registered just to make the integration appear complete.
- Head, torso and leg equipment now use separate shared physical slots in
  campaign and battle inventory. Main-page pocket movement and reload were
  checked. See `docs/gameplay/equipment/body-equipment-2026-09-26.md` for rules and remaining art limits.
- Light-source graphics now distinguish enclosed lanterns on posts, thrown
  wooden torches and campfires in the shared battlefield. The normal Retiro
  campaign page was visually checked. See `docs/development/performance/light-sources-2026-09-26.md`.
- The campaign progression gap was subsequently fixed. New garrisons and
  incursions now scale from 4 to 30 with controlled sectors. Existing forces
  retain their troops. See `docs/gameplay/campaign/campaign-opposition-progression-2026-09-26.md` for
  the rule, regression evidence and limits. This does not establish 60 FPS or
  a completed campaign route under the new balance.
- Continuous walking passed the recorded loaded daylight sample. Reaction
  processing previously caused long frames. Full 60 FPS, including reactions,
  night scenes and the new worker path, remains unverified.

Follow-up: positioning transient notices over the field keeps the map size
constant through contact. Prepared-scene tests now pass the 16.8 ms frame-time
threshold for daylight reactions and day/night camera-follow movement with 30
visible enemies. Initial scenery conversion still produces long frames. See
`evidence/stable-map-frame-rate-2026-09-26.json`; this is not full FPS acceptance.

Group movement now also uses the shared worker. The normal group handler sends
the request without calculating a duplicate preview first. It retains complete,
partial and contact-stop reports. Animation excludes hidden actors and does not
replay the unseen approach of an enemy that has just become visible. The group
panel uses the same fixed-map overlay, with expandable route details. Normal
six-person selection, movement and report controls were exercised in the browser.
See `evidence/group-movement-worker-2026-09-26.json` for frame times and limits.

Formation previews now run only when their detail is open, through a separate
background queue that discards obsolete destinations. The normal root campaign
was used to verify preview replacement, execution and saved positions. See
`docs/development/performance/group-route-previews-2026-09-26.md`.

## Regression coverage

`tests/main-campaign-enhancements.test.mjs` starts from a new campaign, recruits
through the public dispatcher, visits the real sector, and prepares the battle
through the same handoff as the root page. It unloads ammunition, moves through
the shared battle-job function, synchronizes campaign time, round-trips the save,
and renders the shared battlefield. It checks persistent ammunition, illustrated
art and absence of Órdenes. It does not use a hand-built tactical fixture.

That test plus worker and campaign equipment placement tests passed: 9 tests.
This focused result does not establish that the whole dirty worktree or the full
campaign route passes.

## Background individual movement previews

The shared main `Battlefield` now sends `reachable-preview` jobs for the selected
soldier to a preview worker. The job runs the ordinary `getReachable` rules;
orders still validate their own routes. Pointer destinations reuse one request
for the current battle, soldier and movement intent. Changing any of those
invalidates the displayed result. Pending or failed previews cannot provide a
stale conversation approach or movement cursor. No synchronous preview fallback
is used. Group previews share the same queue hook, with separate worker instances.

Validation: 28 focused tests passed, including real worker route equivalence for
combat, exploration, normal movement, preserved facing and missing soldiers;
battle snapshots remained unchanged. Queue cancellation, stale results, campaign
integration and HUD rendering checks passed. Type checking and the production
export passed (961 files, 857 asset references). This individual-preview change
has not yet received a live browser frame-time measurement. It does not establish
full 60 FPS acceptance or complete campaign gameplay.

Follow-up main-page check: on `http://localhost:3000/?qa=1`, imported the normal
six-recruit Retiro campaign, focused S24 then R24, observed `Calculando ruta…`,
then the completed R24 preview. The Enter order moved Acosta three cells from
U24 to R24. F on S24 displayed the point-fire preview. Reloading and choosing
Continuar campaña retained Acosta at R24. Browser warnings/errors were empty.
The QA save key kept the normal user save separate.

This check also prompted a correction: pending/failed reachability now affects
only movement previews, not firearm, grenade or other independent item previews.
Pending movement has a neutral highlight and an explicit calculation message;
failure explains that the actual order will check the route. Preview results
also match job kind as well as battle and request identity. The final focused
suite passed 67 tests; type checking and production export passed. No frame-rate
claim is made from this functional browser check.

## Latest integration validation

The combined campaign-entry, body-equipment, opposition-progression, worker,
ammunition-unload, light-rendering, walking-endurance and tactical-AI checks pass:
137 tests, zero failures. Type checking and production export also pass (961
files, 857 asset references). These checks do not supersede the outstanding
full-suite failures recorded in `docs/verification/current-worktree-regressions-2026-09-26.md`.

A normal campaign attack from a legacy checkpoint exposed a mutual idle battle:
it remained active at turn 81. The shared tactical AI now considers an affordable
firing posture when it has a visible target, no useful current shot and no better
movement choice. The same attack now resolves in defeat at turn 4. This fixes
the observed stall; it does not establish a winning campaign route or balanced
difficulty. New tests execute the posture and following shot through the normal
action reducer, verify both AP costs and ammunition consumption, and check that
planning neither mutates the battle nor uses hidden target positions.

## Binary scenery cache: main campaign check

Cached static-layer PNGs now use binary Blob URLs instead of PNG data URLs.
This removes a PNG FileReader conversion and the corresponding base64 string.
Source SVG and embedded texture preparation are unchanged. Layer replacement,
unmount, cancellation and decode failure release the owned PNG URL.

On the normal root page with the separate `qa=1` save key, started a new campaign,
hired Acosta through Contrataciones and entered Buenos Aires / Retiro through the
campaign map. The battlefield displayed buildings and lantern light, with 169
cached layers using Blob image URLs. Zooming from 200% to 100%, returning to the
campaign map and re-entering the battlefield worked. The Órdenes control was
absent. The normal user save and tab were not changed.

The four resource-lifecycle checks and normal campaign entry / movement / save
integration check pass (5 tests). The production export passes: 961 files and
857 asset references. These checks verify integration and resource handling;
they do not measure FPS or prove that initial scenery conversion meets the
16.8 ms frame budget.

### Shared battle executor lifecycle

The production `useBattleExecutor` hook now tags each mounted effect lifecycle.
An order cancelled during effect cleanup cannot fall back to synchronous combat
or publish its result after the effect starts again. Its final cleanup also cannot
clear the pending flag of a new order. The main campaign uses this same hook.

A mounted React StrictMode regression test reproduced the previous fault before
the fix: the closed worker order returned a battle while the replacement order
was refused. The test now confirms cancellation, acceptance of the replacement
order, duplicate-click protection, and exact reducer output after worker delivery.
The lifecycle, worker, grenade presentation, and main campaign integration checks
passed together (20 tests; `/tmp/granaderos-lifecycle-check.log`). TypeScript checks
also passed. This is an order-lifecycle check, not evidence of sustained 60 FPS or
of full campaign completion.

### Authored animation scheduling — 27 September

`SpriteFigure`, used by the main campaign's shared tactical scene, now schedules
stationary action and breathing updates at the atlas frame boundaries. Previously,
every animated figure ran a requestAnimationFrame callback and attempted a state
update on every display refresh, even when its authored frame had not changed.
Movement remains on the existing movement clock. Still and dead poses do not
schedule recurring work; collapse retains its existing finite completion timer.

The scheduler derives phase from elapsed time, skips missed frames after delayed
timers, stops after the final action frame, and cancels pending work on cleanup.
A deterministic 30-figure, two-second breathing case needs 120 timer callbacks
(60 per second), versus the previous expected 1,800 per second at a 60 Hz display.
This comparison concerns callback scheduling, not measured browser frame time.

All 23 scheduler, sprite-state, skin-rendering and illustrated-runtime checks pass
(`/tmp/granaderos-sprite-clock.log`); TypeScript checks pass. Sustained loaded-scene
60 FPS remains unverified. Equipment-specific artwork and campaign completion
remain separate open requirements.
The production build also passes (`/tmp/granaderos-sprite-clock-build.log`).

### Preview recovery — 27 September

The shared `useBattlePreview` hook now releases a failed worker before reporting
the failure. A later pointer or selection request creates a new worker; previously,
the hook kept the permanently closed executor, so every later preview failed until
the battlefield was remounted. This applies to both individual reachable-area and
formation previews in the main campaign.

Mounted tests reproduced both failures before the fix. They now verify the visible
failed/pending/resolved states, delivery through a new worker, and exact production
preview results. A separate mounted case replaces the battle while work is pending
and verifies that the old route is never exposed. The lifecycle, bounded-queue,
worker and main-campaign checks pass together: 14 tests, no skips
(`/tmp/granaderos-preview-recovery.log`). TypeScript checks pass. This closes a
preview recovery defect; it does not establish full campaign or performance acceptance.
