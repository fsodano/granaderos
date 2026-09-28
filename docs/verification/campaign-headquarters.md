# Configurable campaign headquarters

An optional story-package headquarters selects one of the eleven existing
localities that permit a land-accessible barracks. Open cells and mountain passes
are not valid bases. The base must start under patriot control. Omitted settings
retain Retiro; a package with a headquarters but no explicit territory map starts
with only that base controlled. The stock campaign is unchanged.

The empty initial squad begins there. Supply traverses connected controlled
localities from that origin. Local purchase access, personal-character creation,
workshop repair/replenishment, formation loyalty and headquarters-loss defeat use
the selected base. The existing calendar-raid protection follows it. Original
Retiro/Córdoba/Mendoza workshops remain available when controlled and supplied.

Hiring still checks the actual reception site, control and blockade. New bases
do not silently enable reception or move a hire to a traveling squad. A paid
arrival at the base or a free personal character advances formation normally.
The first chapter, desk and journal use the selected base name; later historical
chapters retain their existing content.

The editor selects and protects the base, retains the old base's current choice,
and permits subsequent ownership edits there. Restoring original territory also
restores Retiro; undo/redo preserves the combined choice. Applying initial state
only once means a saved traveling squad never teleports back to headquarters.

## Verification

Runtime source: `317de6c2481611f3b534129dd59455e49688e5d9`.
The full suite passed **725/725 tests**, with no failures or skips (187686 ms).
Types, production export (721 files, 631 asset references), all 36 numerical
baseline checks and the documentation audit passed. The register retains
189 requirements and 28 evidence records. All 103 local links in the changed
documents resolved. Exact-head CI is required before merge.

- `tests/campaign-headquarters.test.mjs`: all eleven valid bases, invalid/occupied
  bases, older defaults and implicit territory; real free creation, initial
  loyalty, purchases, workshop costs, peaceful entry/return, hiring/arrival and
  travel; connected supply; calendar raid protection; defeat and invalid orders
  after prepared base occupation; draft isolation and saved-content identity.
  A real paid squad also attacks Uspallata from Mendoza and saves the actual
  hostile scene without granting ownership or a victory.
- Worn supplies and base occupation are prepared conditions. They isolate workshop
  payment and defeat settlement, not a wear, enemy-conquest or rescue playthrough.
- `tests/story-editor.test.mjs`: mounted base selector, automatic controlled base,
  editable former base, restore defaults, undo/redo and launch with actual paid
  arrival at the chosen base.
- `tests/campaign-headquarters-render.test.mjs`: actual desk and journal render the
  correct first chapter and objective. This is not live browser evidence.
- Sixteen existing Retiro/territory checks passed unchanged before the full run.
  The first combined new-feature/editor run passed all 41 cases.

## Limits

HQ-01 is bounded. Historical contacts, original side quests, import-port identity,
later chapters and ending rules remain separate. The published armory and raid
models are retained; advanced physical stores and full strategic warfare remain
unintegrated. Arbitrary headquarters choices are not certified as balanced or
completable. No independent complete campaign, live-browser or sustained loaded
combat-performance acceptance is claimed.
