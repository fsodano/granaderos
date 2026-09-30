# Preserve every held gun's load on campaign return

Every held firearm now retains its actual loaded cartridges after a campaign return. This includes fully loaded guns, a two-barrel gun with one remaining charge, an empty gun, and unfinished reload work. There is no longer a separate return rule for ordinary issued weapons and weapons equipped on the campaign map.

Only reserve cartridges return to general stock. Completed charges remain with the soldier and count against the same finite ammunition return allowance. Capture stores the gun's load and work in custody; liberation restores them exactly once. A dead soldier's equipment stays with the body. Dropped and packed weapons remain separate finite items.

The next visit, attack, or defense preserves the actual load, including zero. An empty gun must use the normal reload action. An empty firing click uses that action and consumes the available reserve cartridges; with no reserve, the exhausted cursor remains visible. A loaded last charge is still usable when general stock is empty. Returning to the map, saving/loading, or swapping an already returned gun through the armory cannot refill it.

Initial issue still prepares a previously untracked weapon from finite campaign supplies. Strategic reserve replenishment still tops up to the existing issue target when stock and carrying space permit. This change does not add ammunition calibers, arbitrary second firearms, or manual supply-stack selection; those remain separate inventory requirements.

## Verification and accounting

`tests/campaign-gun-loads.test.mjs` uses actual shots, returns, saves, entry and reload actions. It verifies fully loaded retention, an empty gun through repeated returns, zero-stock exhaustion, the final barrel of a partially discharged gun, and an armory round trip. The existing reload-work and map-equipment tests retain their load, progress, identity, custody, and ammunition checks.

Older return assertions counted all returned charges in general stock. They now count general stock plus cartridges held by recruited living soldiers. The helper deliberately excludes captive, militia, ground and packed-weapon ammunition, whose separate owners remain independently asserted. Specific tests still check exact loaded counts, reserve counts, finite depletion, and immunity to contradictory caller reports. Changing the storage location does not relax the overall cartridge ceiling.

The test route now reloads any known gun below capacity before marching through actual tactical orders. It records that preparation's elapsed time separately. The fresh northern route still has the same battle turn/order counts, casualties, wounds, supplies and contract costs. It reaches Yatasto at hour 215, second 526: twenty additional seconds relative to the partial-work checkpoint. General stock is 499 cartridges and surviving soldiers hold three loaded charges, for the same 502 total.

The same save passes Cuyo recovery and both Mendoza battles with their deterministic replays. The foundry opens at hour 313, second 758, with twenty-one permanent deaths and 573 pesos. Mendoza's preparation includes one five-second reload. Its verifier checks the unchanged 39-hour, 227-second base continuation plus the actual recorded reload-preparation time; it does not mistake an earlier valid input clock for a failed route.

The complete isolated suite passed **1,349/1,349 tests**. Type checking, the production build, and whitespace checks also passed.

## Browser evidence

An isolated demonstration starts after two actual shots from an ordinarily issued two-barrel pistol. The gun has zero loaded rounds and eight reserve cartridges. Return, save/load, and re-entry preserve zero loaded rounds. Finite issue supplies ten reserve cartridges, and pressing R invokes the actual reload reducer: two charges enter the gun and eight remain in reserve. Returning and saving again leave 296 in general stock and two loaded, matching the 298 cartridges remaining after the two shots.

A second controlled case begins with only two total cartridges, expends both through actual shots, then returns, saves, and re-enters. It retains zero ammunition and displays the exhausted X. An attempted firing use cannot change load, stock or time. The normal player campaign is not modified.

The local demonstration is `http://127.0.0.1:3006/` while its development server remains running. It uses production reducers, save functions, target preview and campaign inventory; its test controls are not the game's tactical firing interface. The production right-click and keyboard controls remain covered by their existing tests.
