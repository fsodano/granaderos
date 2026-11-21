# Tactical sprite rendering quality

This note documents the 2D tactical sprite rendering interpolation and the
active-sequence manifest coverage contract for the equipment preview and
published illustrated sprite library. It defines the browser interpolation
policy and the 240-sequence manifest requirement; it makes no artwork
completion claim.

The equipment preview selects the illustrated `granadero-idle` atlas for
Dorrego with no legacy fallback, and the served PNG matches the published file
byte for byte.

Illustrated standing cells contain 156 raster pixels across 52 map units. The
renderer now uses normal browser interpolation for both the body and skin
overlay, instead of forcing nearest-neighbour enlargement. It retains the same
source files, frame selection, map size, anchors and skin colours. This improves
enlarged edges; it does not add detail beyond the authored source resolution.

The static build now requires every active appearance and sequence in both the
published manifest and runtime index. Two matching but incomplete indexes can
no longer pass verification and leave gameplay to select legacy artwork. The
current contract contains 240 active sequences; retired extra atlases remain
valid. This is a runtime coverage check, not a new artwork completion claim.

The renderer keeps the authored atlas pixels unchanged. Enlarged edges are
smoothed by browser interpolation; the source resolution limits detail.
