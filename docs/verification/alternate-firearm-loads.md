# Alternative firearm loads

A firearm can now use its primary ammunition family and up to three alternative
families. The four shared families remain musket, rifle, pistol and shot.
This delivery does not introduce new family definitions.

## Editor

Open **Armas → Cargas alternativas**. Add a family, damage, range and either
single-target or cone fire. Families must be unique and cannot repeat the primary
family. Damage and range are whole values from 1 through 100. Blades cannot use
these fields. Undo, redo, removal, reset, export and campaign launch use the
normal editor flow. Restoring the original primary family immediately restores a
valid draft; a reload of the page is not required.

Optional `alternativeLoads` belongs to the pinned weapon definition. An empty
list disables alternatives. An omitted list uses the built-in alternatives,
unless the primary family has an explicit override. The default smoothbores have
shot or ball alternatives. The Baker rifle retains one default family. All
firearms can receive authored alternatives. These values are gameplay tuning,
not historical ballistic measurements.

## Play

Use **Carga para esta arma** in the armory or personal equipment panel. Empty the
held firearm before selecting a different load. **Descargar arma** returns its
actual loaded family to available pockets. It costs 4 AP in combat or one second
in exploration. In strategic preparation it uses the existing supply-access
rules. It does not sell or convert rounds. An unfinished reload must finish
before unloading or changing the choice. Pocket and AP failures are atomic.

Selection itself costs no AP or time. Reloading still consumes owned compatible
rounds and pays the ordinary reload cost. Automatic preparation purchases only
the selected family's shortfall at the local supplier's price. The selected load
changes damage, effective range and shot pattern. Cone fire can hit other people
in its cone, including allies. AI can select another owned compatible family
when its current family is exhausted, then reload and move into range.

The choice stays with the gun through packing, dropping, transfer, recovery,
campaign return and saves. Old guns without a choice keep their primary load.

## Verification

Eight runtime cases cover strict authoring, conservation, paid purchases,
deployment, unloading, partial reload rejection, real single and cone attacks,
physical transfer, save restoration, pocket/AP limits and AI fallback. Two
mounted interface cases cover the armory and tactical equipment. A mounted editor
case covers edits, undo/redo, validation, resets and a playable saved campaign.

The production browser check launches an authored campaign, hires Acosta at a
safe immediate destination, enters Retiro, unloads one musket round into the
existing stack (3 to 4), and selects the authored shot profile (19 damage,
7 range, single target). No console warnings or errors were recorded. The draft
reset was checked before launch without reloading the page.

See the [evidence record](../evidence/alternate-firearm-loads.json),
[editor image](../evidence/alternate-firearm-loads-editor.png) and
[game image](../evidence/alternate-firearm-loads-game.png).
The advanced local physical-inventory adapter, arbitrary family definitions and
full game/editor acceptance remain separate open work.
