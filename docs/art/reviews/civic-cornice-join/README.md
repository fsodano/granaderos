# Civic cornice and roof join

The current town hall and palace sprites have a plaster cornice with a cap at one source unit above the wall. The native pitched roof began at the wall height and had a real timber underside 7.5 cm below that plane. Copying the cornice alone made the cap cross the roof and show as a pale line on its far edge. This cut joins the full source cornice to the actual roof underside.

The source is `civicUpperStorey()` in `web/app/TacticalBuildingDetails.tsx`. The cornice spans `height - 4` to `height + 1` source units, projects 0.21 tile outward and returns 0.12 tile inward. At the current scale, it is 19.95 cm high, with 25.96 cm outward and 14.83 cm inward projection. It uses the saved wall finish under the source 0.36 plaster overlay; the flat cap uses the matching source trim colour. The mid-storey warm stone bands merged in PR #269 remain exact.

The source roof in `web/app/TacticalRoof.tsx` starts at `wallHeight + 1`. Its illustration has no separate physical underside. The native roof has that timber thickness and four real facades. This adaptation keeps every source cornice corner and both native ridge points. It raises only the main hip eave ring until its underside covers and meets the full cap. The town hall eave grows from 0.20 to 0.21 tile and rises 11.49 cm. The palace keeps its 0.24 tile eave and rises 10.99 cm. The roof uses its existing saved finish and metre-based texture projection. No artwork panel hides the join.

| Building | Before | After | Current sprite |
|---|---|---|---|
| Town hall | [Before](townhall-before.png) | [After](townhall-after.png) | [Source](townhall-current-sprite.png) |
| Palace | [Before](palace-before.png) | [After](palace-after.png) | [Source](palace-current-sprite.png) |

The paired images use the same normal catalogue controls, compiled building and camera. The cornice now forms a continuous pale edge below the roof without the rejected far-edge cap line. The four-facade adaptation is retained. Slabs, terraces, accessible roof routes, short metric heights, edited corner shells, unpainted legacy geometry and normal partial/interior disclosure keep their existing upper trim and roof geometry. All pieces remain on authored wall cells and keep standing doors and windows clear.

Validation:

- 84 focused and affected checks pass in 16.40 s. They cover source body/cap corners and local paints, all four rotations, clay/aged/thatch finishes, elevated foundations, real timber underside coverage, fixed ridge coordinates, far-cap camera rays, metre UVs, standing openings, edited corner fallbacks, usable upper cells, short slabs and normal room disclosure. TypeScript passes.
- Across 48 actual compiled roof/rotation/finish/elevation states, 960 outer-cap samples have a minimum underside clearance of −0.000321 mm (Float32 rounding) and a maximum of 5.418 mm. The supported cap meets the lowest underside within 0.0004 mm. The former roof fails full-cap coverage when the literal source cornice is retained. Its source, camera and opening/fallback checks still pass; the negative control detects the actual unsupported outer cap rather than requiring the earlier bright line at every sampled camera ray.
- A controlled comparison covers 408 compiled states and 10,788 unrelated meshes, including the complete current stone band. Their geometry, materials, world transforms, opening records and room disclosure are byte-identical. The shared JSON hash is `7e252ec732fdab5e0532a4a9ce476774b79ec2504a2ec80a9c9e7c9f7ab43a62`. Only the eligible plaster eave section and its main roof are excluded.
- 24 original before views and 48 ordinary after views pass with no browser errors: 24 original roofs, 12 closed 3 m slabs and 12 accessible 3 m roofs. All four rotations and exterior/partial/interior views are represented. Front/side exteriors, a disclosed interior, a closed slab and an accessible roof were viewed. Each original exterior adds eight triangles and one draw call; disclosed views add none.

Run the portable preservation probe against each tree with `node tools/verify-three-civic-cornice-preservation.mjs <source-root> <output.json>`, then compare the two JSON files. It uses an independent stable scope and can run against the predecessor before the new cornice helper exists.

The rejected literal cornice images and failed checks remain in the private review package. The prior storey-band package remains unchanged. The existing palace portico rear gable appears in both before and after side views and is outside this join correction. This is a bounded cornice/roof repair; it does not claim complete building polish. `source-bounds.json` contains source points, the roof distinction and physical measurements. Base: main `9c3a119e` (PR #269). No actor bank, manifest, gameplay collision or movement changes are included.
