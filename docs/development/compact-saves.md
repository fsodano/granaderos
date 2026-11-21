# Compact campaign saves

Large campaigns retain every visited battlefield, so a full save can exceed the
5,000,000-byte file limit even when the campaign data alone still fits. Schema 2
compacts terrain to keep such a campaign inside the limit; schema 1 remains a
readable and accepted format.

Exports and browser saves use schema 2 when terrain compaction helps a save of at
least 1,000,000 bytes. Smaller files retain readable schema 1. Each regular
terrain grid stores a palette of complete tile properties and an index per
position. Coordinates are reconstructed from the grid. Unordered grids stay
explicit. Units, bodies, inventories, doors, tile metadata, buildings,
encounters, artillery and clocks retain their data. The encoder does not change
the live state.

The decoder accepts both schemas. It checks palette shape, grid dimensions,
indices and a 20,000,000-byte expanded budget before allocating tile copies. The
5,000,000-byte input limit remains. Each restored tile receives its own nested
data, so an edit cannot change another tile through a shared palette reference.
The ordinary campaign and tactical validators run after expansion. Legacy
migration checks retain an unmodified copy of the original version markers.

Compaction changes storage, not the final battle or campaign balance. The
standalone `serializeCampaign` output remains raw campaign data; portable exports
and browser storage use `encodeSave`.
