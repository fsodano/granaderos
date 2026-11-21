# Handheld ammunition

Across the story editor, tactical inventory (exploration and combat), and the campaign armory, the combined game uses four ammunition families. A weapon has one primary family and can accept up to three configured alternatives. An implicit ignition kit replaces separate priming powder and flints.

| Family | Default primary users |
| --- | --- |
| Musket cartridges | Brown Bess, Charleville, tercerola |
| Rifle ammunition | Baker |
| Pistol cartridges | Arzón, duel and double-barrel pistols |
| Shot loads | Escopeta and trabuco |

Smoothbores can use the configured shot alternative. Select a load only after unloading the gun. The selected family sets damage, range and shot pattern. A gun rejects ammunition outside its configured families, and an empty gun with no compatible reserve names the load it needs. Unloading returns the actual rounds to pockets and requires space; tactical unloading also spends AP. Partial loading, chosen family and loaded rounds stay with the physical weapon through hand changes, storage, drops, recovery and saves. See alternative loads.

Loose rounds have one owner: physical inventory stacks. A cursor stack, chamber, stored gun, body or ground cache owns its own contents. Display totals cannot create another reserve. Pocket stacks hold up to 20 rounds at 0.04 weight per round. Transfers, splitting and collection retain their family. Artillery uses its own finite ammunition.

Campaign purchases spend pesos and reduce finite local supplier stock. The authored market sets price, initial stock, capacity, restock interval and automatic preparation. Automatic preparation can use carried rounds and local stores before buying missing rounds at an eligible supplied town. No production recipe or global material stock supplies cartridges. Returning from a sector retains owned rounds instead of refunding or issuing them again. Authored suppliers set prices, finite stock and replenishment.

Historical caliber keys remain save identifiers and map to these four families. Known legacy schemas migrate once. Invalid or mixed ownership records are rejected. The consolidation migrates the published personal reserve into physical pockets.

Reference: Patusco's JA2 Strategy Guide 1.3 (cited as **G** in [the JA2 parity requirements](../../requirements/ja2-parity.md#scope-and-evidence)), pages 49–50, describes compatibility and ammunition availability. The costs, pocket quantities and period adaptation are Granaderos rules.
