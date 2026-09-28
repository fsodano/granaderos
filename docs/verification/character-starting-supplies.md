# Character starting supplies

Source: `5abbe16b3290c41753a1571c15d8b22267ec1f4b`.

The story editor exposes per-character initial priming charges, flints, rations,
torches, dressings and boleadoras. Each count is an integer from 0 to 1000. All six
fields are required when the optional allocation exists. Unknown keys, fractions,
missing fields and out-of-range values are rejected. Older packages retain the
original 50/4/2/2/2/1 defaults without rewriting their content identity.

The allocation is applied only when a new campaign attaches its content. Paid
candidates remain off-map until actual arrival; world and historical actors keep
in-person recruitment. Mutable amounts belong to the saved service record, not
the author's package. Explicit zero reaches the actual deployed soldier.

## Acceptance

`tests/character-supplies.test.mjs` covers package export/import and rejection,
real six-hour paid arrival, actual torch use, refusal after exhaustion, active
save/reload, sector departure, paid renewal, dismissal and paid rehire. The
consumed torch and other zero supplies stay empty. A subsequent workshop visit
charges its real refill price and uses the established targets without lowering
surplus rations or adding boleadoras. A new world resident is physically hired,
uses its torch, leaves service and is hired again with the consumed amount.
Historical Cabral recruitment also preserves an explicit zero allocation.

The mounted editor test in `tests/story-editor.test.mjs` changes dressings and
torches, undoes/redoes, duplicates a character, resets and restores its allocation,
blocks an invalid launch, then launches, hires, waits and verifies the actual
saved soldier. Simulation/DOM coverage does not establish live-browser usability.

Release checks: **805/805 tests**, zero failures or skips (192,057 ms); type
check; production export (721 files, 631 asset references); 36 baseline checks;
documentation audit (204 requirements, all 50 original and 87 parity rows,
43 evidence records). Exact-head GitHub CI is required before merge.

## Limits

This delivers starting personal supplies. It does not implement civilian loot,
arbitrary inventory, custody, merchant stock or successor equipment transfer.
The player-created officer keeps its existing allocation. Cartridge deployment
and paid workshop refill rules remain separate. No historical or advanced gameplay
requirement becomes complete solely because this bounded feature is verified.
