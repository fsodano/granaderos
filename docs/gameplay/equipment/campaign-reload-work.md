# Preserve unfinished reloads on campaign return

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

Unfinished loading now survives a campaign return for an ordinary issued gun as well as a map-equipped gun. A soldier must finish the remaining work through the normal reload action. Returning to the map, saving, loading, or entering another sector cannot finish or erase that work.

The ammunition return plan retains the completed barrel charges with the gun and returns only the reserve cartridges to general stock. The retained amount is deducted from the existing issue/loot allowance. Captured soldiers keep the load and unfinished work in custody; a returning or escaping soldier keeps it in their own carried weapon record. No cartridge is consumed for unfinished work. A charge consumes one reserve cartridge only when it is completed.

This uses the existing validated carried-loading state. Subsequent deployments retain the exact load, even if empty. A completed continuation clears the unfinished fraction and preserves the completed charge. No-ammunition reload attempts retain the fraction without spending time or changing physical state.

## Verification

All 1,345 automated tests, TypeScript checking, the production build, and whitespace checks passed in the isolated gameplay checkout.

`tests/campaign-reload-work.test.mjs` starts actual partial reloads with ordinary issued weapons, without the map-preparation marker. It covers a Baker rifle and a two-barrel firearm, repeated campaign returns and save/load cycles, the exact remaining exploration duration, reserve consumption, zero-ammunition rejection, capture/departure ammunition plans, and paid preparation before a march. Existing full map-equipment capture/rescue tests continue to cover campaign custody settlement.

The route controller now finishes pending loading through actual visits, hand selection, reload actions, clock synchronization, and return reports. It never changes a unit's load, work, health, or ammunition directly to prepare the march. It records each completed reload and verifies that loaded plus reserve cartridges remain constant. The northern acceptance test still requires the same battle outcomes, casualties, wounds, supplies, and contract costs.

The fresh northern verifier reaches Yatasto at hour 215, second 506, ten seconds later than the previous checkpoint. Three reload continuations account for that difference: officer 1000 before Córdoba (62 AP equivalent, four seconds); operative 128 before Tucumán (42 AP equivalent, three seconds); and operative 142 before the joint Salta march (34 AP equivalent, three seconds). Combat turn/order counts and the fifteen permanent deaths are unchanged. All twelve saves were written, read back, and validated. The new Yatasto save also passed the Cuyo recovery and Mendoza continuation verifiers. The foundry checkpoint is hour 313, second 733, with the same twenty-one permanent deaths, retreat/rescue outcomes, and 573-peso treasury. The exact Mendoza continuation duration remains 39 hours and 227 seconds from its input.

The browser check used a controlled combat fixture and the production reducers, save functions, and campaign inventory component. Cabral had paid 35 AP toward a Baker reload before the fight ended. After returning to the map, saving/loading, and re-entering the sector, the gun remained empty at 50% work. Completing it used the remaining 35 AP equivalent as three exploration seconds, moved exactly one of ten reserve cartridges into the gun, and cleared the partial fraction. Another return and save/load retained the charge. General stock was 298 and the held gun contained one cartridge, matching the 299 cartridges left after the fixture's one actual shot. The normal player campaign was not changed.

The independent local demo is `http://127.0.0.1:3005/` while its development server remains running. Its buttons exercise actual return, save/load, entry, and reload actions; it is a controlled fixture rather than a full live campaign playthrough.

## Subsequent full-load update

The [persistent gun-load update](campaign-gun-loads.md) removes the former exception for ordinary fully loaded and empty guns. Every held firearm now keeps its actual load on return. The earlier timings and ammunition figures above record the partial-work checkpoint; use the linked update for the current route and full accounting.
