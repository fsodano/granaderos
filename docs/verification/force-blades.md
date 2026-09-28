# Primary and secondary troop blade loadouts

The editor permits any authored firearm or blade as the primary weapon for each
published enemy role and militia rank. Secondary blades have separate optional
maps (`oppositionBlades` and `militiaBlades`). Each map includes every group role;
a null secondary selection retains that role's original numeric blade. An absent
map preserves the prior behavior. A null primary selection still means no primary
weapon. Secondary choices do not implicitly replace or equip the primary slot.

Only fresh generated soldiers receive configured gear. Existing soldiers keep
saved equipment, ammunition, condition and active hand. Firearm primaries retain
the published finite cartridge allocations. A blade primary receives zero loaded
rounds, reserve cartridges and priming powder. Its separate secondary can use a
different variant. Secondary authoring also works without primary authoring.

Enemy AI can switch from a gun to an authored secondary when the target enters its
reach, or when the gun is empty and the target is close. Outside blade reach it
can return to a loaded gun, or to a gun with reserves when the target is farther
away. Normal four-AP switching applies. Getting up and escaping restraint precede
weapon selection. Existing primary blades remain usable directly. Old troops
without authored secondary metadata retain their prior decision rules.

## Verification

Runtime source: `19457d4a200cdb4b74610952ea3a7db7f8d28199`.
The first complete run at `695a298` passed 704 tests. Final review also corrected
the displayed bayonet AP reserve and guarded malformed weapon entries; all
12 focused review checks passed. The final full suite passed **704/704 tests**,
with no failures or skips (185653 ms). Types, production export (721 files,
631 asset references), all 36 numerical baseline checks and the documentation
audit passed. The register retains 186 requirements and 25 evidence records.
Exact-head CI is required before merge.

- `tests/force-blades.test.mjs`: both maps and reference guards; actual campaign
  attack issuance; zero cartridges for primary blades; real enemy turns with
  close/distant targets and a knocked-down soldier; real militia training,
  switching, return, save and re-entry; secondary-only and original selections.
  Another case recovers a generated enemy's primary blade and preserves it through
  retreat and a saved revisit, without reissuing the corpse's weapon.
- AI and loot checks use compact prepared terrain with real generated soldiers.
  They are not full campaign routes or broad tactical decision acceptance.
- `tests/story-editor.test.mjs`: normal controls for both troop slots, undo/redo,
  original secondary selection, deletion protection and launch into an actual
  attack with both authored definitions and zero primary-blade ammunition.
- `tests/content-blades-ui.test.mjs` also checks the displayed edited bayonet reserve.
- Existing troop firearm, inventory, ammunition, blade, save and legacy cases remain
  in the complete suite.

## Limits

TROOP-01 is bounded. Complete equipment authoring, merchant rules and full gameplay
remain partial. This does not add secondary corpse looting, civilian belongings,
blade wear, editable special techniques, artillery, fittings, cartridge authoring
or complete hand/weapon custody. The legacy unarmed and fallback bayonet model
still needs integration with the advanced hand system. No full campaign, live
browser or sustained loaded-battle performance acceptance is claimed.
