# Compact campaign saves

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../verification/published-progress.md) for the main branch baseline.

Large campaigns retain every visited battlefield. The verified northern route exposed a full save of 5,035,492 UTF-8 bytes when it entered the final Buenos Aires battle. That exceeded the 5,000,000-byte file limit even though the campaign alone still fitted.

Exports and browser saves now use schema 2 when terrain compaction helps a save of at least 1,000,000 bytes. Smaller files retain readable schema 1. Each regular terrain grid stores a palette of complete tile properties and an index per position. Coordinates are reconstructed from the grid. Unordered grids stay explicit. Units, bodies, inventories, doors, tile metadata, buildings, encounters, artillery and clocks retain their data. The encoder does not change the live state.

The decoder accepts both schemas. It checks palette shape, grid dimensions, indices and a 20,000,000-byte expanded budget before allocating tile copies. The existing 5,000,000-byte input limit remains. Each restored tile receives its own nested data; edits cannot change another tile through a shared palette reference. The ordinary campaign and tactical validators still run after expansion. Legacy migration checks retain an unmodified copy of the original version markers.

The reproduced final-battle save now occupies **1,581,968 bytes** and restores to an exactly equal campaign and battle. A separate supported large-map fixture exceeds the old raw-file limit, restores every map, and produces the same next tactical turn. Tests cover old files, unordered tiles, nested-data independence, malformed compact data, expansion limits and legacy civilian migration in schema 2.

A live check in the separate `?qa=1` slot imported the real compact final-battle save, reloaded the page and resumed Buenos Aires with all three living soldiers and their ammunition intact. A legal crouch order for Barcala then survived another reload with 85 HP and nine reserve cartridges. The regular user save was not used.

Validation: 2,664 tests pass with no skips, including the continuous route through Humahuaca; type checking, production build and diff checks pass.

This fixes storage, not the final battle or campaign balance. The blockade and wider gameplay audit remain open. Standalone `serializeCampaign` output remains raw campaign data; portable exports and browser storage use `encodeSave`.
