# Tactical sprite rendering quality

Verified on 12 September 2026 against the equipment preview and the published
illustrated sprite library.

The reported screenshot showed a much coarser character than the approved art.
A fresh load of the reported preview on port 3023 selected the illustrated
`granadero-idle` atlas for Dorrego, with no legacy fallback. The served PNG
matched the published file byte for byte. The original screenshot's load state
could not be reproduced, so a stale tab or cache is not a confirmed cause.

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

Validation:

- 30 focused sprite, skin, layout and asset tests passed.
- TypeScript and the production build passed. The static export verified 960
  files and 856 asset references.
- A browser comparison used the same actual sprite component, source, frame,
  direction and size with the previous and updated sampling policies. Standing
  enlargement was inspected at 800%; aiming, crouched and prone poses at 300%.
  Walking-frame DOM checks confirmed the same atlas crop and matching body/skin
  interpolation. These checks do not establish animation timing.
- The actual equipment scene was inspected at 200% and 300%. Dorrego loaded the
  approved illustrated sprite. No browser warnings or errors were recorded.

No source artwork or atlas pixels were changed.
