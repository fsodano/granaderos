# Tactical reference graphics

[Implementation plans](README.md)

This plan defines 18 visual improvements to 3D characters, terrain, vegetation,
and furniture against reference images. Each numbered change gets its own
acceptance criteria and visual review.

## Visual target

The reference images [1000338062.jpg](../references/tactical-graphics-2026-10-08/house-interior.jpg)
(house/interior) and [1000338063.jpg](../references/tactical-graphics-2026-10-08/clearing-characters.jpg)
(clearing/characters) are visual references. They are not game assets.
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

## Improvement pieces

Work through this order. A piece is ready for review once its visual checks and
local gates pass.

| # | Concrete improvement | Detail and acceptance |
| --- | --- | --- |
| 1 | Granadero and worker cloth form | Strengthen existing fold valleys and ridge shading around sleeves, elbows, waist and knees. Allow a bounded change to the navy base-cloth colour resource where the dark atlas leaves no highlight range. Preserve the old atlas, trim and skin; use the current geometry. Compare front, side and rear at 44 and 88 pixel actor height. Keep face/skin maps and every rig/action payload exact. |
| 2 | Cloth form across the other six families | Extend the reviewed treatment to realista, cirujano, gaucho, fraile, exploradora and mujer con rebozo. Respect the long-cloth, skirt hem and boot-clearance corrections. Check standing, crouched and prone poses. |
| 3 | Cloth, leather and metal surfaces | Add restrained low-frequency cloth pigment variation and broad boot wear. The current cloth is already matte; retain its roughness and normal maps. Restrict aged metal finish to named steel/brass equipment, keeping polished blades, grip leather, uniform facings and trim exact. Check moving figures for sparkle and preserve faction colours. |
| 4 | Correct coarse poncho surface directions | Correct gaucho LOD1/2 poncho normals where inner and outer surface directions mix after reduction. Keep oriented triangles, positions, UVs, colours, skin weights, all close models and all other families exact. Run the unchanged cloth recipes using validated historical selection masks. Review front, side and rear at 44/88 pixels and moving/posture views. Add no triangles or drawing parts; record extra stored/indexed corners required for the surface split. |
| 5 | Check coarse outer garments in movement | Test bounded fits for the worker LOD2 vest and shawl LOD1/2. A rest-only coupled shell fails in native motion. Original-overlay trials preserve openings and weights but show no clear improvement at 44/88 pixels; the worker exceeds its 6 mm displacement bound. Keep the original models. A future fit needs a visible benefit and no worse outside contacts in motion. |
| 6 | Relaxed free arm in standing weapon rest | Unarmed figures already have relaxed native arm positions. Give blade, knife and pistol standing idles an independent relaxed free left arm while retaining the right hand's weapon pose. Preserve rifle contacts, unarmed, aim, brace, attack, crouch/prone and paid-action timing. Record bounded transition contacts and exact source/export receipts. |
| 7 | Irregular soil/grass boundaries | Add uneven, seeded edge incursions using existing textures. Join equal-height outdoor surfaces only. Include neighbouring material/type in chunk cache dependencies. Check the edge across chunk borders and after a neighbouring tile change. |
| 8 | Sparse soil fragments | Add uneven groups of small flat pebble chips to dirt/roads/natural stone. Leave bare patches. Keep fragments rooted at the terrain elevation and visible at normal zoom. Cap decoration cost per cell. |
| 9 | Thin dry weeds | Add occasional branched stems with varied height and lean in dry grass/scrub. Keep road centres and indoor cells clear. Match the reference's thin dark silhouettes without a uniform field of identical tufts. |
| 10 | Varied rock forms | Add a small set of asymmetric rock forms with broken ledges and flatter tops. Retain obstruction height, placement and current bounds. Keep the existing geometry budget. |
| 11 | Broken leaf silhouettes | Replace solid crown lobes with irregular leaf sprays and gaps. Keep rooted branches, tree height variation, poplar proportions, actor canopy fade and the existing material batches. |
| 12 | Timber furniture construction | Show tabletop/bench boards and narrow joints; use edge rails instead of a solid apron. Add chest lid construction, hinges and handles. Preserve open states, usable sides and all four rotations. |
| 13 | Soft bedding | Round mattress and pillow forms; add blanket folds and a hanging edge. Keep the bed frame, floor height, authored footprint and rotations. Review beside a standing character. |
| 14 | Complete washstand | Carry the existing pitcher/handle, basin water and hanging towel from the authored furniture view into native 3D. Give the towel a folded outline. Keep every part within the washstand footprint. |
| 15 | Complete cooking hearth | Add the existing cooking pot, rim, bail handle and supporting iron. Keep embers and the stone firebox visible. Face generated hearths into their admitted room while preserving authored rotations. Preserve fire and light rules. |
| 16 | Varied shelf vessels | Replace repeated generic cylinders with a few vessel profiles, visible lips and openings. Preserve office/archive ledgers and semantic room selection. |
| 17 | Gathered sacks and woven rugs | Add tied sack mouths and broad creases; add rug bands and fringe. Keep floor contact, footprints and door clearances. Use shared batches and materials. |
| 18 | Room floor character | Extend the existing semantic floor finishes with continuous plank joints, restrained room variation and entrance wear. Clip around climb openings. Preserve the upper walking deck and hatch appearance. Add no raised surface that implies a new obstacle. |

If review finds a specific mismatch that these pieces do not address, add a
bounded piece with its own acceptance criteria. A passing test or a completed
checklist is not proof that the reference's appearance has been reached.

See the [phone picture gallery](../art/tactical-reference-gallery-2026-10-08.md).

## Visual review and checks

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
  build and `git diff --check`. Compare against a matching clean baseline before
  recording a failure.
- Verify ordinary in-game controls in the preview. Offline renders support
  visual review but do not prove browser shader, action or save behaviour.
- Record draw calls, triangles and a bounded frame-time sample for changes that
  add geometry, materials or shader work. Preserve chunk reuse and disposal.

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
