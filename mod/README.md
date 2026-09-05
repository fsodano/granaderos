# Granaderos engine overlay

This is an initial, engine-readable data conversion, **not a completed historical campaign**. Copy this directory's contents over the pinned engine's `gamedir`, supply the retail JA2 `Data` assets, and launch `Granaderos.cmd`. `ja2.ini` selects `vfs_config.Granaderos.ini`; the mod mounts after Data-1.13 and before its separate writable user profile. Start a new game.

Regenerate tables with `python3 tools/generate_campaign.py` from the repository root. Upstream table hashes and the exact source commit are recorded in `Data-Granaderos/campaign-manifest.json`. The generator uses the Python standard library and explicit UTF-8. Generated XMLs are complete tables because the engine VFS resolves a whole file and loaders such as `Utils/XML_Items.cpp` clear their destination arrays. They are not XML fragments merged with the baseline.

## Implemented data

- All thirteen specified operatives have their exact ten primary statistics and weekly pay. The `EXP` specification column correctly maps to explosives, not experience level. Twelve officers occupy AIM profile IDs 0–11. San Martín occupies Miguel's engine-defined ID 57 and retains his recruitable NPC type. Sex/body values are corrected for Azurduy and Macacha. Existing engine traits are used as explicitly approximate equivalents; custom named abilities require code.
- Firearms occupy 1800–1808 in specification order; melee weapons occupy 1809–1813. All firearms have correct capacity, impact, ready/reload values and ranges (tiles converted to engine range units). Separate ammunition calibers and cartridge items 1900–1917 provide loaded-capacity and 20-cartridge supply forms, both required by the engine magazine resolver. Readiness and firing formulas still require runtime balancing.
- Loadouts contain historical firearms/blades, cartridge supplies and field supplies. Existing medical/tool functions remain attached to linen bandages, surgical instruments and gunsmith tools. No fictional modern protective armor is assigned.
- AIM exposes only the twelve converted starting officers. MERC initial recruitment is disabled. San Martín is excluded from the starting AIM roster.
- All baseline items remain defined for engine/map references but modern shop inventory is disabled. Enemy/militia generated gun pools use flintlocks. Other random equipment pools are emptied to suppress automatic armor, explosives and electronics. ASD's tank/jeep/robot assignments are disabled in a full options overlay.
- Item 1840 is a hidden nonlethal black-powder smoke emitter, referencing Explosives class106 with radius2 and duration3, for the engine mechanic patch.

## Remaining fidelity and verification

Original map geography, scripted NPC inventories, dealers, IMP gear, quest rewards, biographies, speech, most portraits, item icons and tactical animations still require replacement. Modern items already placed in original maps are **not** removed by the shop restrictions. City names are deliberately unchanged until historical sectors/maps are authored; relabeling Arulco would not establish Argentine geography.

San Martín currently inherits Miguel's legacy recruitment quest; the El Plumerillo unlock is not yet implemented. Other officers are exposed for development without their regional faction gates. Contract periods remain JA2's periods, not monthly stipends. Artillery, horses, naval travel, factions, territorial economy, foundry manufacturing, diplomatic progression, custom traits and the complete sequence of battles remain required work. The specification's bayonet/lance reach and melee AP values are not achieved by XML alone. Smoke/misfire/prone-reload behavior depends on separate engine code.

`python3 -m unittest discover -s tests -p test_campaign.py -v` verifies complete-table preservation, deterministic output, roster statistics, recruitment indices, weapon/ammunition references and capacities, historical loadout references, modern store exclusion and nonlethal smoke properties. These are data checks; they do not prove a successful engine launch or campaign playthrough.
