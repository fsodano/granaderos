# Two-hand equipment

Every soldier has two visible hand slots. Muskets, rifles, carbines, shotguns and the blunderbuss occupy both hands. The three pistol types use one hand. A second one-handed weapon can share the hands with a pistol. Selecting medical supplies, a tool or a usable supply item puts that item in the active hand and stores any displaced long gun in a real pocket.

The old primary/blade fields now represent owned item records, not extra free storage. A spare blade beside a two-handed gun consumes a pocket. A long gun put away needs a large pocket. A held unit of medical supplies, tools or usable supplies is excluded from pocket contents; the remaining quantity stays in pockets. Explicitly freeing the hands checks the space needed to store all weapons. Selecting equipment fails before spending AP if the final layout cannot fit.

To carry two pistols, open Equipment and orders, select a pistol in a pocket, then choose the second-hand destination. The main strip and inventory show both guns, each with its own load and condition. Select the second hand to use that gun. This costs 4 AP in combat. Equipping a stored gun costs 6 AP. Exploration spends time instead of AP. Firing and reloading operate on the selected gun. Each item keeps its identity, condition, jam state, loaded cartridges, partial reload work and compatible fittings. This change does not introduce simultaneous dual-gun firing.

Equipment planners validate the final layout as one transaction; a temporary intermediate arrangement cannot reject a valid full-pack swap. Dropping or passing the selected weapon leaves the other held weapon in hand. Invalid destinations, insufficient AP and lack of storage leave ownership and ammunition unchanged. Corpses, deliberate drops, transfers, the strategic sector inventory, campaign returns, capture/rescue, repair queues and public player-state projections include the second gun.

## Verification

The full suite passes 1,476 tests. Sixteen new tests cover hand occupancy, full-pack swaps and drops, independent weapon loads and reload work, fitting retention, second-hand loot/transfer, corrupted or duplicate records, public-state privacy, campaign save/reentry and rendering. The existing capture/rescue test now checks the second gun; equipment repair checks its finite cost and retained load. Type checking, production export and diff checks pass.

A separate browser fixture uses the production Battlefield, inventory and tactical reducer. Equipping a second pistol used 6 AP; selecting it used 4 AP (100 to 90). Save/load retained its two loaded barrels at 57% condition and the other pistol's one loaded round at 81%. Firing the selected pistol reduced only its load and condition (two to one, 57% to 56%) and used 8 AP. A long gun displayed a blocked second hand and its spare blade in a pocket. Selecting bandages moved the loaded, fitted gun into a large pocket.

Full JA2 equipment parity is still incomplete. Arbitrary items cannot yet be freely placed into either hand, outfit/protection remains a flag rather than a transferable item slot, and body/head equipment is not implemented. The current gun selection and AP values are the period game's rules.
