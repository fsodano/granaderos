# Changelog

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
