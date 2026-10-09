# Tactical reference graphics

[Implementation plans](README.md)

8 October 2026. Baseline: `origin/main` at `c71dce85`. Worktree:
`tactical-graphics-reference`. This is an implementation plan, not a claim of
published graphics parity. Each numbered change gets its own PR and visual record.
The user requested merges on 8 October 2026. Merge each completed PR after its
visual checks and local gates pass, then synchronize local `main` safely.

## Visual target

The user supplied [1000338062.jpg](../references/tactical-graphics-2026-10-08/house-interior.jpg)
(house/interior) and [1000338063.jpg](../references/tactical-graphics-2026-10-08/clearing-characters.jpg)
(clearing/characters). These are visual references. They are not game assets.
The second image sets the character priority: natural adult proportions, narrow
limb silhouettes, readable spaces between limbs, dull clothing, and folds with
clear light and shadow at a small screen size. Keep the Argentine period clothing.
Review at normal tactical size as well as close zoom. Close renders alone cannot
prove that an improvement survives in play.

The environment target is irregular ground, coarse soil fragments, thin dry
weeds, broken foliage outlines, and interiors with recognisable household objects.
Furniture should show how it is built and how people use it. Fabric should have
soft edges and folds. Buildings should retain their existing historical forms.

Current code already has native human anatomy, cloth geometry, face maps, seams,
plaster and roof textures, furniture, semantic room dressing, roof cutaways,
grass, rocks, and varied trees. Extend those systems. Do not replace them with
generic substitutes or claim that an existing feature is absent.

## Small delivery pieces

Work through this order. Mark a piece ready only after its visual checks and
local gates pass. Record its PR beside the status; an open PR is not publication.

| # | Concrete improvement | Detail and acceptance | State |
| --- | --- | --- | --- |
| 1 | Granadero and worker cloth form | Strengthen existing fold valleys and ridge shading around sleeves, elbows, waist and knees. Allow a bounded change to the navy base-cloth colour resource where the dark atlas leaves no highlight range. Preserve the old atlas, trim and skin; use the current geometry. Compare front, side and rear at 44 and 88 pixel actor height. Keep face/skin maps and every rig/action payload exact. | [PR #306](https://github.com/fsodano/granaderos/pull/306) merged; [visual record](../art/character-cloth-depth-review-2026-10-08.md) |
| 2 | Cloth form across the other six families | Extend the reviewed treatment to realista, cirujano, gaucho, fraile, exploradora and mujer con rebozo. Respect the long-cloth, skirt hem and boot-clearance corrections. Check standing, crouched and prone poses. | [PR #307](https://github.com/fsodano/granaderos/pull/307) merged; [visual record](../art/character-family-cloth-depth-review-2026-10-08.md) |
| 3 | Cloth, leather and metal surfaces | Add restrained low-frequency cloth pigment variation and broad boot wear. The current cloth is already matte; retain its roughness and normal maps. Restrict aged metal finish to named steel/brass equipment, keeping polished blades, grip leather, uniform facings and trim exact. Check moving figures for sparkle and preserve faction colours. | [PR #308](https://github.com/fsodano/granaderos/pull/308) merged; [visual record](../art/character-apparel-surfaces-review-2026-10-08.md) |
| 4 | Correct coarse poncho surface directions | Correct gaucho LOD1/2 poncho normals where inner and outer surface directions mix after reduction. Keep oriented triangles, positions, UVs, colours, skin weights, all close models and all other families exact. Run the unchanged cloth recipes using verified historical selection masks. Review front, side and rear at 44/88 pixels and moving/posture views. Add no triangles or drawing parts; record extra stored/indexed corners required for the surface split. | [PR #309](https://github.com/fsodano/granaderos/pull/309) merged; [visual record](../art/character-poncho-normals-review-2026-10-08.md) |
| 5 | Check coarse outer garments in movement | Test bounded fits for the worker LOD2 vest and shawl LOD1/2. A rest-only coupled shell failed in native motion. The later original-overlay trials preserved openings and weights but showed no clear improvement at 44/88 pixels; the worker exceeded its 6 mm displacement bound. Keep the original models. A future fit needs a visible benefit and no worse outside contacts in motion. | Review complete; candidates rejected; [trial record](../art/character-outer-garment-fit-review-2026-10-08.md) |
| 6 | Relaxed free arm in standing weapon rest | Unarmed figures already have relaxed native arm positions. Give blade, knife and pistol standing idles an independent relaxed free left arm while retaining the right hand's weapon pose. Preserve rifle contacts, unarmed, aim, brace, attack, crouch/prone and paid-action timing. Record bounded transition contacts and exact source/export receipts. | [PR #312](https://github.com/fsodano/granaderos/pull/312) merged; [record](../art/character-standing-free-arm-review-2026-10-08.md) |
| 7 | Irregular soil/grass boundaries | Add uneven, seeded edge incursions using existing textures. Join equal-height outdoor surfaces only. Include neighbouring material/type in chunk cache dependencies. Check the edge across chunk borders and after a neighbouring tile change. | [PR #310](https://github.com/fsodano/granaderos/pull/310) merged; [record](../art/terrain-boundaries-review-2026-10-08.md) |
| 8 | Sparse soil fragments | Add uneven groups of small flat pebble chips to dirt/roads/natural stone. Leave bare patches. Keep fragments rooted at the terrain elevation and visible at normal zoom. Cap decoration cost per cell. | [PR #311](https://github.com/fsodano/granaderos/pull/311) merged; [record](../art/soil-fragments-review-2026-10-08.md) |
| 9 | Thin dry weeds | Add occasional branched stems with varied height and lean in dry grass/scrub. Keep road centres and indoor cells clear. Match the reference's thin dark silhouettes without a uniform field of identical tufts. | [PR #313](https://github.com/fsodano/granaderos/pull/313) merged; [record](../art/dry-weeds-review-2026-10-08.md) |
| 10 | Varied rock forms | Add a small set of asymmetric rock forms with broken ledges and flatter tops. Retain obstruction height, placement and current bounds. Keep the existing geometry budget. | [PR #314](https://github.com/fsodano/granaderos/pull/314) merged; [record](../art/rock-forms-review-2026-10-08.md) |
| 11 | Broken leaf silhouettes | Replace solid crown lobes with irregular leaf sprays and gaps. Keep rooted branches, tree height variation, poplar proportions, actor canopy fade and the existing material batches. | [PR #315](https://github.com/fsodano/granaderos/pull/315) merged; [record](../art/leaf-sprays-review-2026-10-08.md) |
| 12 | Timber furniture construction | Show tabletop/bench boards and narrow joints; use edge rails instead of a solid apron. Add chest lid construction, hinges and handles. Preserve open states, usable sides and all four rotations. | [PR #316](https://github.com/fsodano/granaderos/pull/316) merged; [record](../art/timber-furniture-review-2026-10-08.md) |
| 13 | Soft bedding | Round mattress and pillow forms; add blanket folds and a hanging edge. Keep the bed frame, floor height, authored footprint and rotations. Review beside a standing character. | [PR #317](https://github.com/fsodano/granaderos/pull/317) merged; [record](../art/soft-bedding-review-2026-10-08.md) |
| 14 | Complete washstand | Carry the existing pitcher/handle, basin water and hanging towel from the authored furniture view into native 3D. Give the towel a folded outline. Keep every part within the washstand footprint. | [PR #318](https://github.com/fsodano/granaderos/pull/318) merged; [record](../art/washstand-review-2026-10-08.md) |
| 15 | Complete cooking hearth | Add the existing cooking pot, rim, bail handle and supporting iron. Keep embers and the stone firebox visible. Face generated hearths into their admitted room while preserving authored rotations. Preserve fire and light rules. | [PR #319](https://github.com/fsodano/granaderos/pull/319) merged; [record](../art/hearth-review-2026-10-08.md) |
| 16 | Varied shelf vessels | Replace repeated generic cylinders with a few vessel profiles, visible lips and openings. Preserve office/archive ledgers and semantic room selection. | Ready: native live review, final local gates and sealed complete input proof pass; [record](../art/shelf-vessels-review-2026-10-08.md). |
| 17 | Gathered sacks and woven rugs | Add tied sack mouths and broad creases; add rug bands and fringe. Keep floor contact, footprints and door clearances. Use shared batches and materials. | Private final candidate ready: native live review, 69 affected checks, 6,862 quick tests, typecheck, build and complete input proof pass. Publication follows piece 16. |
| 18 | Room floor character | Extend the existing semantic floor finishes with continuous plank joints, restrained room variation and entrance wear. Clip around climb openings. Preserve the upper walking deck and hatch appearance. Add no raised surface that implies a new obstacle. | Private final candidate ready: live ground/upper views, ordinary climb/walk/descent, 6,869 quick tests, typecheck, build and complete input proof pass. Publication follows pieces 15–17. |

If review finds a specific mismatch that these pieces do not address, add a
bounded piece with its own acceptance criteria. Do not count a passing test or
a completed checklist as proof that the reference's appearance has been reached.

Pieces 1–15 have completed review; accepted improvements are merged and piece 5
is a rejected private trial. Pieces 16–18 have completed native browser review,
typecheck, production build and their standard quick runs. Piece 16 retains an
unknown standalone affected-process exit after a collector error. Its full
quick passed all six focused files and the overall process. The separate
execution-gap proof records that distinction. Publish in order after installed
root proofs pass.

## Delivery and checks

- Use one focused branch per piece in the isolated worktree. Use an explicit
  staged file list. Start independent pieces from current `origin/main`; use an
  explicit stacked base when a piece depends on an earlier open PR.
- Keep simulation, AP, ammunition, health, visibility, saves, collision, input
  orders, actor roots, sockets and timing authoritative. Cosmetic detail must
  not consume simulation randomness or reveal hidden actors/rooms.
- Use fixed-view before/after captures with the same pose, light, zoom and LOD.
  Character records must include normal tactical scale, 2x scale, standing,
  walking, rifle aim, crouch and prone. Include all affected families and LODs.
  Compare limb, head and garment widths at the same actor height. If a broad
  silhouette remains, add a specific garment-fit piece; surface contrast alone
  does not prove that the reference's character shape has been reached.
- Extend the compact review fixtures as pieces need them. The initial furniture
  scene has only seven prop types; later pieces need the washstand, hearth,
  vessels, sacks and rugs in a real interior. Use ordinary stance orders or an
  expanded valid fixture to check all eight families, not just two posture actors.
- Run affected renderer/asset tests, `npm run test:quick`, typecheck, production
  build and `git diff --check` before each push. Record an existing failure as an
  existing failure only after a matching clean-baseline check.
- Verify ordinary in-game controls in the live preview. Offline renders support
  visual review but do not prove browser shader, action or save behaviour.
- Record draw calls, triangles and a bounded frame-time sample for changes that
  add geometry, materials or shader work. Preserve chunk reuse and disposal.
- Open and attach a separate PR for each concrete improvement. State the final
  scope, validation, visual evidence and remaining limits. Do not trigger paid
  Actions as a debugging loop.

## Implementation boundaries

Character work starts in `assets/source/characters-3d/authoring/character.py`,
`optimize.py`, and the selected-asset tools under `tools/characters-3d/`. Surface
passes can append colour resources without changing geometry/animation bytes.
Asset receipts and source authoring must reproduce the published candidate.

Terrain and vegetation work uses `web/lib/three/world-terrain.ts`,
`world-vegetation.ts`, `world-geometry.ts`, and `sector-world.ts`. In particular,
the current terrain cache includes neighbour elevation; a boundary blend also
needs neighbour type/material/building dependencies.

Furniture uses `web/lib/three/world-props.ts` and shared primitives/materials.
`web/app/TacticalProps.tsx` retains useful authored small details. Preserve
`presentWorld()` exact-room admission and `roomDressings()` door clearances.
Floor work uses `world-buildings.ts` and `world-materials.ts`.
