# Initial funds and cartridge allotments

The story package can set initial treasury and separate cartridge allotments for
each squad firearm deployment, freshly generated enemy and freshly issued
militiaman. Values are whole numbers: 0–1,000,000 pesos and 0–100 cartridges.
Missing rules in an older package preserve 3200 pesos and 10/13/6 cartridges.
Explicit rules must contain exactly the four supported fields.

Initial treasury applies only when attaching content to a new campaign. Save
restoration preserves current funds and rejects altered pinned content. Player
entry and attacks charge one peso per issued cartridge. Real weapon capacity
limits loaded rounds; the remainder becomes reserve ammunition. Zero is valid,
and blade primaries receive no cartridges. Existing return/refund and finite
loot rules remain in force. Existing enemies and militia retain their spent
supplies rather than receiving a new allotment.

The editor's Rules tab supports undo/redo, restoring defaults and validation.
Campaign entry shows the actual configured price. Packages without authored
force weapon assignments can still configure ammunition for the original guns.

## Verification

Runtime source: `faf262934a02efe6ba9fa5fe7682cb267ff269c7`.
The full suite passed **711/711 tests**, with no failures or skips (186799 ms).
Types, production export (721 files, 631 asset references) and all 36 numerical
baseline checks passed. The documentation audit retains 187 requirements and
26 evidence records. [PR #49](https://github.com/fsodano/granaderos/pull/49)
was accepted at `62c2930c4053a08a6b0a12a296e9c0026d2410ca` after
[exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36380575045/job/108795325989)
passed; merge commit `ab5d50441c8d1ab9f4a3888421fd4e19205c3fa7`.

- `tests/campaign-rules.test.mjs`: package round-trip and malformed values; original
  defaults; initial funds once; actual hiring and free personal-character creation
  with zero funds; content identity; actual sector entry, capacity, treasury and
  refunds; real attack issuance with zero or separate allocations; blade exclusion;
  militia training, one actual shot, campaign return, save and re-entry.
- The militia shot uses prepared safe territory and a nearby hostile in an actual
  campaign-issued scene. It tests spent supplies, not a complete liberation route.
- `tests/story-editor.test.mjs`: the mounted editor authors all values, undoes and
  redoes edits, blocks invalid limits, restores defaults, recovers the prior values
  and launches a campaign with actual funds and attack ammunition.
- `tests/campaign-rules-ui.test.mjs`: mounted game controls return to campaign,
  display the configured entry price, charge it on entry, issue the chosen rounds
  and persist the exact active campaign/battle pair.
- The first focused run used an incomplete personal-character fixture. Supplying
  the actual version-2 questionnaire resolved those test failures; no admission
  rule was relaxed. All five focused simulation cases then passed, as did the
  mounted editor and game cases.

## Limits

RULES-01 closes only this supply subset. STORY-05 and STORY-06 remain partial.
Mission allies retain their own supplies. Priming powder, flints, ammunition
types, cartridge prices, care, progression, merchant stocks, starting ownership
and campaign roles still needed authoring at this checkpoint. A later delivery
adds [starting control and loyalty](starting-territory.md), followed by
[headquarters selection](campaign-headquarters.md). Other historical role rules
remain open. A zero-money campaign may
require a free personal character and zero-cost deployment settings; authoring does not promise
that arbitrary settings produce a balanced or completable scenario. No complete
campaign, live-browser or sustained loaded-battle performance acceptance is claimed.
