# Aged roof finish review — 7 October 2026

The current posta sprite selects aged clay. Its retained raster colour map receives `saturate(.55) brightness(.84)` in `TacticalRoof.tsx` and `TacticalBuildingVolumes.tsx`. The 3D material shared the ordinary clay map without this colour treatment, so authored aged roofs stayed too bright and orange.

The aged material now applies the same saturation and brightness in encoded sRGB, then returns the sampled colour to linear lighting. Its separate shader cache key keeps ordinary clay intact. Both finishes retain the shared texture, physical tile spacing, bump relief, vertex lighting and authored roof selection. No generated bitmap or gameplay state changes.

Six preliminary playable posta views passed without browser errors. Its front was compared directly with the current sprite: the aged tiled field is darker and less saturated. Native lighting changes the final pixels, so this is a finish correction, not a claim of pixel identity. The posta's obscured corner capitals remain a separate shell-placement defect.

The clean committed cut passed 13 roof/flat-roof/surface checks in 5.10 seconds, type/docs/baseline checks and the production export (1,244 files; 1,039 references; build `8ad62aa5610d`). Twelve final clean playable posta/estancia views passed without browser errors at `artifacts/three-aged-roof-cut-review/`. The posta front and clay estancia side were inspected. The clay control retains its selected finish, tile spacing and relief. Thatch colour treatment and support placement remain separate work.
