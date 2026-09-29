# Safe migration to an implicit ignition kit

The basic ignition kit is part of firearm maintenance. Separate priming powder
and flint stocks do not occupy personal pockets or limit reloads and field
maintenance. Prepared cartridges remain finite physical items. Weapon condition,
misfires, action costs and elapsed time still apply.

## Published save correction

Runtime source: `20b21e38a87ad93a63bf3a1297b1dec13ee89f71`.

The earlier migration recursively deleted every property named `priming` or
`flints`. That could erase an ordinary named inventory object. The replacement
visits known unit and scene records. It removes retired supply counters and their
hand, cursor, pocket, ground and container references. It preserves ordinary
inventory entries, cartridges, pinned story packages and extension dictionaries.
Repeated save restoration produces the same result and does not alter the input.

Four new tests cover the known holders, equipment references, pinned content and
an actual campaign save. All ten related tests, types, production export and 36
reference comparisons pass. The complete remote suite gates the final PR head.
The earlier local full run passed 1,292 tests, but preceded the final correction
and fourth new test; it is not final-source acceptance.

## Separate advanced local game

The same migration helper is integrated with the advanced local game. Reloads,
paired weapons, maintenance, AI, workshop service, inventories and campaign
restoration use the implicit kit. Maintenance retains its AP or exploration-time
cost. Workshop replenishment charges only for missing personal supplies.

The production preview shows one loaded shotgun round and nine spare rounds in
the ordinary pockets, without separate flint or priming powder stocks. Pocket
artwork loads and the browser reports no errors.
[Preview capture](../evidence/implicit-ignition-integration.png).

Before the final test-controller correction, the complete advanced mirror run had **3,210 passes and six failures out of 3,216
tests**, with no skips. This is not acceptance of the complete local game:

- Late-worker movement timing expects 365 ms but receives 315 ms. The same
  failure is reproduced in the untouched original checkout.
- Two portrait-source checks fail because the mirror lacks the generated source
  manifests. Both checks pass in the original checkout.
- The fresh campaign, established opening and prisoner-rescue routes fail.
  Their legal completion and combat balance remain open.

The route controller still required obsolete priming stock before clearing a jam.
After correcting that condition, the affected routes have three passing checks,
four failures (including a failed parent) and three skipped milestones. They
reach the same failure points as the unchanged original checkout: missing relief
medic, defeated Córdoba recapture and defeated prisoner relief. Earlier San
Lorenzo and Córdoba milestones pass again.

The focused maintenance, reload, pocket, AI, saved-state and cartridge-custody
checks pass. Type checking and the production export pass (1,107 files and 993
asset references). The evidence record identifies the exact local file hashes;
this local source is separate from the smaller published game.

The 60-file local change was copied only after every original target matched its
saved pre-edit hash. All 62 focused checks and the original checkout's types and
production build pass. The verified local server was restarted on port 3000.
The existing Buenos Aires campaign opens with unchanged visible health and
loaded/spare ammunition values; its pockets omit the retired supplies. No new
campaign or gameplay order was issued.
[Existing campaign capture](../evidence/implicit-ignition-live.png).

## Remaining work

The advanced local game still has nine historical cartridge keys. Its conversion
to the four published families, integration of authored family selection and
alternative loads per firearm remain open. This change does not close full
campaign, complete story editor, movement artwork or performance acceptance.

[Evidence record](../evidence/implicit-ignition-integration.json).
