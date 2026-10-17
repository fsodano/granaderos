# Changelog

> **Release history.** Entries describe their recorded checkpoints. Read
> [shipping campaign plan](plans/core-campaign-v0.1.md) for current scope. Earlier development
> numbers are internal checkpoints; their features and results are dated history.

## 0.1.13 — Proposed (unreleased)

- Clear a refused autonomous enemy action before a valid player interrupt.
  Invalid player orders retain their normal atomic refusal.
- Keep inventory details tied to the inspected pocket after an item moves to
  the hand. Narrow 3D wall pointer regions so normal mouse clicks reach the
  visible door; preserve SVG, keyboard and gameplay behavior.
- Expand automated campaign route drivers and their fresh regressions for
  paid recovery, roof access, cannon crew, finite aid and the real Ensenada
  battle. Admitted nonclinical crews use the existing coordinator. Field
  physicians use actual interrupts for adjacent aid; explicit convoy primary
  preparation preserves default medical hands. These drivers use existing
  game rules. Later staging and finite-supply corrections pass 34/34 whole-file
  component cases (receipt `065f7e5e...`); their four-path transfer is committed.
  Physician-posture route-driver controls also pass 15/15 across their whole
  file (receipt `cbc5376c...`); the tested helper and regression are committed
  in integration. Complete-route and full-suite acceptance remain open.
- Preserve battle/preparation limits, finite supplies, permanent losses,
  paid service, duties and homes. Keep the reviewed Cuyo four-battle report
  and every other original campaign assertion.
- Campaign acceptance remains open. The last completed unfiltered gate has
  1,109 passing and six failing files out of 1,115; its 8,351 cases contain
  8,341 passes, eight failures and two dependent skips. Later focused evidence
  has 47 actual cases passing; receipt `8f508014...` and count reconciliation
  `04412bc5...` preserve its original expected-count mismatch. Component
  passes do not replace complete-route acceptance.
- The latest completed opening file is 4 pass / 2 fail / 2 dependent skip
  (receipt `92574b0b...`). The latest ending file is 0/2: the loose route lacks
  finite field dressings after convoy recovery; the installed route retreats
  at Ensenada (receipt `eed89130...`, log `b23337ef...`). No original file is
  running. Earned ending and 48 campaign-hour continuation remain open.
- Desktop mouse review of private build `6344e3a8a632` on source `3b415db5`
  verifies both door leaves and the wall target (record `842e28b0...`). Short
  desktop frame samples cover Retiro and six-actor San Lorenzo playback.
  Normal controls continue two interrupts and return player control; observed
  frame spikes reach 208.4 ms. These short samples do not establish cold-entry,
  sustained or large-battle performance. Cannon,
  earned ending, continuation and bounded final manual acceptance remain open.
  Candidate `6c8f82bc` differs from main `6a5218de` in 228 tracked paths;
  recount final scope before publication. Version 0.1.13 is not published.

## 0.1.12 — 16 October 2026

- Build and publish the verified GitHub Pages export after each push to `main`.
- Retain manual builds and main-only publication. Pull requests, tags and other
  branch pushes do not start a Pages build; simulation and Windows workflows
  retain their existing triggers.

## 0.1.11 — 16 October 2026

- Keep tactical inventory rows within the phone panel.
- Group height and access controls with posture controls to preserve space for
  the equipment grid.
- Let the inventory portrait shrink on short desktop panels so the posture
  controls stay visible.

## 0.1.10 — 16 October 2026

- Expose nearby items, doors and containers through a separate Entorno control
  in tactical inventory. Keep its panel separate from selected-item details.
- Keep the two panels mutually exclusive and retain normal keyboard focus
  and scrolling without increasing HUD height.
- Verify the existing inventory, environment and equipment controls: 33 focused
  tests passed.

## 0.1.9 — 16 October 2026

- Show remaining recruitment contract time in short hours and minutes instead of
  raw fractional hours. Preserve exact contract timing and prices.
- Verify the display and existing contract controls: 25 focused tests passed.

## 0.1.8 — 15 October 2026

- Start the standalone San Lorenzo battle at its authored 08:00 daytime clock.
  The new campaign retains its separate midnight start.
- Verify the real launcher path, its chosen force and the absence of campaign
  save writes when starting the standalone battle.

## 0.1.7 — 15 October 2026

- Resolve a town representative's income source from the active campaign.
- Verify real authored conversations, campaign-specific amounts and exact
  midnight payments through saved continuation.

## 0.1.6 — 15 October 2026

- Apply resident fortification cover to the actual roof or ground surface occupied
  by each defender. Preserve stronger cover and the existing paid fort levels.
- Align the version file and browser package metadata with this release.

## 0.1.5 — 15 October 2026

- Keep the route confirmation quote tied to the selected destination while the
  map previews possible additional waypoints.
- Explain occupied district restrictions and offer the main sector for normal
  route planning.

## 0.1.4 — 14 October 2026

- Close the command menu after importing a save. Reset the previous route,
  strategic clock, desk tab and arrival selection for the restored game.

## 0.1.3 — 14 October 2026

- Center the tactical camera on the selected soldier when entering exploration
  or resuming a sector. Arrival placement keeps its full-field overview.

## 0.1 — 10 October 2026

Git tag: `0.1`. Package/build version: `0.1.0`. Playable development checkpoint.

- Records the current Spanish browser game, persistent campaign systems, finite
  equipment, Three.js actors, shared wall edges and visible firearm projectiles.
- Corrects the README and current guides, indexes and requirement summaries.
- Makes equipment commerce deferral and remaining campaign acceptance limits explicit.
- Records complete author and community campaign creation/sharing as future work.
  Existing experimental editors and the example remain available.
- Synchronizes version metadata. This checkpoint changes no gameplay rules.

See [the checkpoint record](verification/version-0.1.md) for validation, save
compatibility and open work. The source tag does not deploy GitHub Pages.

## 0.4.0-dev.1

- Removed the artificial day-only cap on elite specialists: day, weekly and monthly
  contracts are open to every volunteer, and the treasury alone limits the terms.
- Elite specialists now charge premium daily rates (1100-1600 pesos at level 1), so
  the 3200-peso starting treasury cannot retain one for more than a day or two.
- Contract renewals extend the remaining service instead of resetting it to 24 hours.

## 0.1.0-dev.2

- Added the Cabildo custom officer examination, civic volunteer recruitment and combat experience growth.
- Implemented four custom tactical doctrines, finite priming powder/flints/rations, weapon repair and persistent field supplies.
- Added distinct melee reactions, bayonet bracing, knockdown and physical routing with weapon drops.
- Added named Royalist commands, ordered northern invasions, revenue-driven naval pressure and interior supply sabotage.
- Installed cannon/foundry art and eight infantry action poses; added battle zoom, explicit errors, mobile inspector controls and optional synthesized sound effects.
- Strengthened save validation and dynamic-artwork export verification.

Browser verification created and deployed a custom officer, recruited a civic volunteer, restored both through save/resume, and checked battlefield zoom. Automated tests cover the rule changes. Full animation, dialogue, balance and end-to-end campaign acceptance remain incomplete.

## 0.1.0-dev.1

Initial playable Spanish browser campaign and tactical milestone. Thirteen historical portraits, fourteen authored maps, production/diplomacy/recruitment, black-powder rules and static export. GitHub web CI passed for commit9a9ca07 (run33964710149).

## 0.1.0-dev.3

- Separate campaign desk, service dossiers and local tactical conversations.
- Individual horse ownership, rider assignment, forage, breeding and peaceful post-victory play.
- Eight-direction infantry walking, building roofs, windows and independent door leaves.
- Night visibility controls AI targeting; temporary lights age across sector visits.
- Recovered weapon inventory exchanges conserve ammunition and condition.
- Two explicitly fictional foreign volunteers, original personalities and event dialogue.
- Shared validation for save files and persistent sectors.

Validation: 155 engine tests passed before final presentation integration; browser checks exercised desk navigation, adjacent NPC greeting, horse purchase/assignment/feeding. Full campaign fidelity and cavalry gait remain ongoing work.

## 0.1.0-dev.4

- Actual eight-direction cavalry walking, crouched infantry movement and prone crawling, with original Blender sources.
- Timed militia courses led by local hired instructors, finite promotions, supply pauses and assignment restrictions.
- Capped use-based skill gains with persistent trained attributes.
- Original foreign volunteer portraits and browser-friendly tactical keyboard controls.
- Reproducible opening two-battle legal-action playthrough and full requirement audit.

Validation: 166 tests pass; TypeScript and static build pass (155 files, 73 checked references). Campaign remains incomplete; audit documents remaining work.

## 0.2.0-dev.1

- New campaigns begin with an empty roster at a sidebar Escritorio.
- One free personal Granadero with original portrait choice, nickname, manual attributes, era class and operational questionnaire-derived traits/personality.
- Fictional paid volunteer catalogue with full dossiers, portraits, day/week/month contracts, experience-scaled quotes and capped daily elite contracts.
- Compact strategic personnel/map/orders screen with delimited city areas.
- Complete-city control and loyalty gate militia; adjacent NPC supply errands reward local loyalty once.
- Historical figures remain personal encounters. Legacy saved campaigns are preserved.
- Workshop, diplomacy, journal and campaign objective actions are available from desk folders.


## 0.3.0-dev.1 — campaign consequences and local defenders

- Trained militia deploy as persistent local tactical allies with finite ammunition,
  rank equipment, retained injuries and conserved casualties.
- Riding practice improves actual proficiency; practiced sector tiles survive
  re-entry to prevent farming. Dossiers and tactical sheets expose progress.
- Expanded era-appropriate keyboard commands and Spanish help; local militia
  remains separate from the six hired squad shortcuts.
- Foreign standing changes import prices, national contributions have deadlines,
  neglected emancipation/commissions reduce support, and frontier requisitions
  can break agreements and provoke economic raids.
- Living companions deliver their campaign-ending lines once.

Validation: 209 tests, TypeScript and production export pass. Browser acceptance
trained three militia, entered their sector and opened the separate garrison panel.
Recruitment and strategic-map screenshots were captured for the user. Full-game
implementation remains active; naval missions, full equipment/industry chains,
scripted campaign encounters and battlefield scale still require work.
