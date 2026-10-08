# Source door cross bands — 2026-10-08

Basis: main `f01916b070b4dfd59a92ef20c50d184ba8a194a1` (PR #286).

The chapel closed timber leaf, seams, handle and hinges already exist. Its current sprite makes two horizontal bands clear. The native bands were only 32 mm high; `Opening` in `web/app/TacticalArchitectureMaterials.tsx` uses 1.3 units over the 33-unit door height (75.4 mm at a 1.9149 m aperture), at 7/33 and 24/33 of the leaf. Source pigment is `#4b4435`. Source side insets are one unit in an 18-unit plank opening or a 28-unit double/barn/arched opening.

This correction gives full authored non-panelled leaves those source proportions and diffuse pigment on both sides. Each physical double leaf retains a separate band and working hinge; that is an explicit physical adaptation of the sprite's continuous band. The depth stays 16 mm, at its existing face plane. Bands stay wholly inside the leaf footprint. The wood map, wood relief, seams, panelled doors, hinges, handles and barn braces are unchanged. No global material or lighting change is included. Saved styles are still authoritative. Legacy default leaves and low cutaway leaves retain their old behavior.

## Visual comparison

[Current chapel sprite](source-chapel.png), [ordinary before](chapel-before.png), [ordinary current](chapel-current.png), [normal maximum zoom before](chapel-close-before.png), and [normal maximum zoom current](chapel-close-current.png). All HUD screenshots use the visible catalogue and normal camera controls. The bands are clearer, especially in the normal close view; the leaf remains dark in the recessed doorway shadow. This cut does not claim complete doorway lighting or architectural polish.

Supplied playtest references 002 and 008 were inspected in the byte-preserved primary `docs/references/playtest-2026-10-03/images` archive. They support readable detailed timber surfaces, door frames and cutaway boundaries. Their modern appliances are not used as historical decoration. The actual period door recipe comes from the current Granaderos sprite and `Opening`, not from those modern interiors.

## Validation

- Eight focused door checks pass; twenty adjacent surface/window/compiled sandbox checks pass. Logs are retained here.
- Source band sizes/colour, both faces, all 14 actual compiled templates, four rotations and original/slab/usable roofs are tested. Open-door approach and sight rays at 0.5/1.0/1.65 m remain clear. Ordinary breaches remove leaves; short cutaways omit full bands/hardware.
- TypeScript passes.
- The integration checkout repeats all 28 affected checks and TypeScript on
  `9b3798475a94eee22ed9993a20292f49ee7e9c14` (PR #287). The production build
  `31b72760dec1` passes and verifies 1,304 exported files and 1,041 asset
  references. A normal catalogue review loads its actor with zero pending
  models and shows both bands with the standard camera controls.
- Portable comparison: 504 compiled states, 10,240 non-band meshes and 468 admitted band meshes. Every other vertex channel, material property, node transform/metadata and compiled gameplay input is exact. It covers all 14 templates × four rotations × exterior/partial/interior × original/closed slab/usable roof.
- 18 ordinary original-roof before views and 18 current views pass without browser errors. Eight normal maximum-zoom before/current views each pass. Six current closed-slab and six usable-roof views pass. Geometry preservation proves those roof/disclosure variants stay exact outside the bands.

Repeat the focused checks with:

```sh
node --test tests/three-building-doors.test.mjs tests/three-building-door-source-bands.test.mjs tests/three-building-surfaces.test.mjs tests/three-building-windows.test.mjs tests/renderer-sandbox-fixtures.test.mjs
node web/node_modules/typescript/bin/tsc --noEmit -p web/tsconfig.json
node tools/verify-three-door-band-preservation.mjs /path/to/unchanged-predecessor /path/to/current-candidate
```

Both comparison checkouts must have the normal web dependencies available. The preservation tool admits only original cross-band triangles inside their measured leaf bounds and the replacement named band meshes. It checks all other geometry exactly.

The separate low-ceiling motion trial remains held. No body, face, native bank, actor consumer, game rule, collision, doorway dimension, roof route or room disclosure change is included.
