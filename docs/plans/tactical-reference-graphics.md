# Tactical reference graphics

[Implementation plans](README.md)

8 October 2026. Baseline: `origin/main` at `c71dce85`. Worktree:
`tactical-graphics-reference`. This is an implementation plan, not a claim of
published graphics parity. Each numbered change gets its own PR and visual record.
PRs remain open for review unless the user requests a merge.

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
| 1 | Granadero and worker cloth form | Strengthen existing fold valleys and ridge shading around sleeves, elbows, waist and knees. Allow a bounded change to the navy base-cloth colour resource where the dark atlas leaves no highlight range. Preserve the old atlas, trim and skin; use the current geometry. Compare front, side and rear at 44 and 88 pixel actor height. Keep face/skin maps and every rig/action payload exact. | [PR #306](https://github.com/fsodano/granaderos/pull/306) open; [visual record](../art/character-cloth-depth-review-2026-10-08.md) |
| 2 | Cloth form across the other six families | Extend the reviewed treatment to realista, cirujano, gaucho, fraile, exploradora and mujer con rebozo. Respect the long-cloth, skirt hem and boot-clearance corrections. Check standing, crouched and prone poses. | Implemented on `codex/character-family-cloth-depth`, stacked on #306; [visual record](../art/character-family-cloth-depth-review-2026-10-08.md) |
| 3 | Cloth, leather and metal surfaces | Add restrained low-frequency cloth pigment variation, belt/boot wear and material-specific roughness within the existing apparel atlas. Keep wool and linen matte. Check moving figures for sparkle and preserve faction colours. | Planned |
| 4 | Character detail at distant LOD | Retain simplified closure, shoulder/back seams and useful strap edges at LOD2. Remove the baseline worker vest and shawl shoulder's unintended pale flecks, and inspect the coarse poncho's dark facets. Preserve real buttons, trim and garment colours. Compare the actual 44 pixel figures, not only the authoring mesh. Check weapon and posture contacts and report triangle/draw-call cost. | Planned |
| 5 | Relaxed free arm in standing weapon rest | Unarmed figures already have relaxed native arm positions. Blade, knife and pistol idle bindings share ready or aiming poses. Give those three standing idles an independent relaxed free left arm while retaining the right hand's weapon pose. Preserve rifle two-hand contacts, unarmed, aim, brace, attack, crouch/prone and paid-action timing. Check grip contacts and idle-to-action transitions on both anatomies and all eight families. | Planned |
| 6 | Irregular soil/grass boundaries | Add uneven, seeded edge incursions using existing textures. Join equal-height outdoor surfaces only. Include neighbouring material/type in chunk cache dependencies. Check the edge across chunk borders and after a neighbouring tile change. | Planned |
| 7 | Sparse soil fragments | Add uneven groups of small flat pebble chips to dirt/roads/natural stone. Leave bare patches. Keep fragments rooted at the terrain elevation and visible at normal zoom. Cap decoration cost per cell. | Planned |
| 8 | Thin dry weeds | Add occasional branched stems with varied height and lean in dry grass/scrub. Keep road centres and indoor cells clear. Match the reference's thin dark silhouettes without a uniform field of identical tufts. | Planned |
| 9 | Varied rock forms | Add a small set of asymmetric rock forms with broken ledges and flatter tops. Retain obstruction height, placement and current bounds. Keep the existing geometry budget. | Planned |
| 10 | Broken leaf silhouettes | Replace solid crown lobes with irregular leaf sprays and gaps. Keep rooted branches, tree height variation, poplar proportions, actor canopy fade and the existing material batches. | Planned |
| 11 | Timber furniture construction | Show tabletop/bench boards and narrow joints; use edge rails instead of a solid apron. Add chest lid construction, hinges and handles. Preserve open states, usable sides and all four rotations. | Planned |
| 12 | Soft bedding | Round mattress and pillow forms; add blanket folds and a hanging edge. Keep the bed frame, floor height, authored footprint and rotations. Review beside a standing character. | Planned |
| 13 | Complete washstand | Carry the existing pitcher/handle, basin water and hanging towel from the authored furniture view into native 3D. Give the towel a folded outline. Keep every part within the washstand footprint. | Planned |
| 14 | Complete cooking hearth | Add the existing cooking pot, rim, bail handle and supporting iron. Keep embers and the stone firebox visible. Preserve fire and light rules. | Planned |
| 15 | Varied shelf vessels | Replace repeated generic cylinders with a few vessel profiles, visible lips and openings. Preserve office/archive ledgers and semantic room selection. | Planned |
| 16 | Gathered sacks and woven rugs | Add tied sack mouths and broad creases; add rug bands and fringe. Keep floor contact, footprints and door clearances. Use shared batches and materials. | Planned |
| 17 | Room floor character | Extend the existing semantic floor finishes with continuous plank joints, restrained room variation and entrance wear. Clip around climb openings. Add no raised surface that implies a new obstacle. | Planned |

If review finds a specific mismatch that these pieces do not address, add a
bounded piece with its own acceptance criteria. Do not count a passing test or
a completed checklist as proof that the reference's appearance has been reached.

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
