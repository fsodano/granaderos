# Plaster finish review — 7 October 2026

The retained plaster sprite contains both its base pigment and dark weathering.
Multiplying its full colour by the authored 3D wall tint made limewashed and
ochre facades read as brown stone. The current 2D town hall reference has pale
stucco and modest variation.

The material now uses the authored finish as its base and blends the existing
texture colour at 20% for limewash, 30% for ochre and 35% for adobe. The existing
texture, physical UV scale and bump relief are retained. Brick, stone, timber,
roof materials, collision and room disclosure keep their own construction.
The material shader preserves texture alpha and the normal lighting/shadows.

The same town-hall side-wall screenshot patch changes from median RGB
102/90/62 to 124/121/103. Its brown saturation is lower, and windows, stone trim
and civic arches remain readable. The supplied 2D reference is still brighter;
different lighting means these samples are a visual comparison, not a
calibrated material measurement. Broad walls now have mild texture contrast
at the review zoom. Local lower-wall wear remains a later detail opportunity.

Four compiled templates were captured in six normal exterior/partial/interior
states each: casa, cabildo, ayuntamiento and palacio. The exterior images were
viewed against the earlier support captures and the direct current 2D town hall
render. Evidence is in the ignored `artifacts/three-gameplay-review/finish/`
and `supports/` directories. `tools/verify-three-catalog.mjs` reproduces these
views through ordinary controls. Catalogue and general scene checks now reject
browser console errors as well as failed assets, so a shader compile failure
cannot pass as a successful geometry load.
