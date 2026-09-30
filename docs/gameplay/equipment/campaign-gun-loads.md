# Preserve every held gun's load on campaign return

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

Every held firearm now retains its actual loaded cartridges after a campaign return. This includes fully loaded guns, a two-barrel gun with one remaining charge, an empty gun, and unfinished reload work. There is no longer a separate return rule for ordinary issued weapons and weapons equipped on the campaign map.

Loose cartridges and completed charges remain with the soldier. They do not return to a global pool or refund money. Local stores and finite merchant stock remain separate owners. Capture stores the gun's load and work in custody; liberation restores them exactly once. A dead soldier's equipment stays with the body. Dropped and packed weapons remain separate finite items.

The next visit, attack, or defense preserves the actual load, including zero. An empty gun must use the normal reload action. An empty firing click uses that action and consumes the available reserve cartridges; with no reserve, the exhausted cursor remains visible. A loaded last charge is still usable when the local supplier has no cartridges. Returning to the map, saving/loading, or swapping an already returned gun through the armory cannot refill it.

A previously untracked starting weapon receives its initial charge from owned cartridges or a finite town purchase. Buying, storing or taking loose cartridges before the first deployment does not change that initial-issue status. An explicitly equipped weapon keeps its physical load instead. A supplied controlled town can buy the shortfall to the authored marching allowance, subject to the supplier rules and pocket capacity. These purchases add loose rounds to tracked guns; they do not reload them. A depleted supplier cannot refill a gun or its reserve. See [strategic ammunition](../../verification/strategic-ammunition-custody.md) and [authored suppliers](../../verification/authored-ammunition-markets.md) for prices, finite stock and replenishment.

## Verification and accounting

`tests/campaign-gun-loads.test.mjs` uses actual shots, returns, saves, entry and reload actions. It verifies fully loaded retention, an empty gun through repeated returns, zero-stock exhaustion, the final barrel of a partially discharged gun, and an armory round trip. The existing reload-work and map-equipment tests retain their load, progress, identity, custody, and ammunition checks.

Current return checks count player-owned sector stores and cartridges held by recruited living soldiers. Merchant, captive, militia, ground and packed-weapon ammunition have separate owners. Tests compare merchant depletion, actual payments and carried rounds through repeated entries. They use actual shots and reload orders, finite suppliers and saved return reports. A town purchase must not be mistaken for a free ammunition grant.

## Historical isolated evidence

The route, suite and browser records below predate the treasury-only economy and this consolidation. Their global-stock figures and test counts are historical. They are not current acceptance. See [latest consolidation checks](../../verification/latest-build-consolidation.md) for current evidence.

The test route now reloads any known gun below capacity before marching through actual tactical orders. It records that preparation's elapsed time separately. The fresh northern route still has the same battle turn/order counts, casualties, wounds, supplies and contract costs. It reaches Yatasto at hour 215, second 526: twenty additional seconds relative to the partial-work checkpoint. General stock is 499 cartridges and surviving soldiers hold three loaded charges, for the same 502 total.

The same save passes Cuyo recovery and both Mendoza battles with their deterministic replays. The foundry opens at hour 313, second 758, with twenty-one permanent deaths and 573 pesos. Mendoza's preparation includes one five-second reload. Its verifier checks the unchanged 39-hour, 227-second base continuation plus the actual recorded reload-preparation time; it does not mistake an earlier valid input clock for a failed route.

The complete isolated suite passed **1,349/1,349 tests**. Type checking, the production build, and whitespace checks also passed.

## Browser evidence

An isolated demonstration starts after two actual shots from an ordinarily issued two-barrel pistol. The gun has zero loaded rounds and eight reserve cartridges. Return, save/load, and re-entry preserve zero loaded rounds. Finite issue supplies ten reserve cartridges, and pressing R invokes the actual reload reducer: two charges enter the gun and eight remain in reserve. Returning and saving again leave 296 in general stock and two loaded, matching the 298 cartridges remaining after the two shots.

A second controlled case begins with only two total cartridges, expends both through actual shots, then returns, saves, and re-enters. It retains zero ammunition and displays the exhausted X. An attempted firing use cannot change load, stock or time. The normal player campaign is not modified.

The local demonstration is `http://127.0.0.1:3006/` while its development server remains running. It uses production reducers, save functions, target preview and campaign inventory; its test controls are not the game's tactical firing interface. The production right-click and keyboard controls remain covered by their existing tests.
