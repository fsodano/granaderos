# Church nave edge separation review — 7 October 2026

This follows the closed church nave support cut at `3965710a`. The original and close native images show the pale caps and warm stone feet, while the sloping body has weak face separation at the ordinary camera. The physical body is present: rays through the actual four compiled rotations meet its outer body before the wall, with 39.2 cm of relief beyond the centred shell. This is a local readability correction, not a change to its shape or footprint.

Reviewed evidence:

- Native ordinary 0°: `artifacts/three-church-nave-cut-review/original/iglesia-0-exterior.png`.
- Native ordinary 90°: `artifacts/three-church-nave-cut-review/original/iglesia-90-exterior.png`.
- Native close 90°: `artifacts/three-church-nave-cut-review/close/iglesia-90-exterior.png`.
- Current direct sprite: `artifacts/three-gameplay-review/direct-facade-audit/iglesia-0-exterior.png`.

The current `ArchitectureVolume` in `web/app/TacticalBuildingVolumes.tsx` uses the local palette shadow to outline each vertical face at 0.45 source units and its cap at 0.5 source units. The nave now adds those same measured borders as thin local geometry. At the retained 25.0667 source units per metre, these are 1.795 cm and 1.995 cm wide. The body shadow follows its authored palette; the separate foot retains its warm source shadow `#776d54`. Shared edges are drawn once. The lower seam uses the final stone overlay's shadow. The bottom border is clipped at the actual ground plane.

The native camera looks from positive X/Z, while the sun is on the negative X/Z side. The visible vertical faces therefore have similar hemisphere lighting; the sloping caps have more direct light. The flat sprite also has explicit face strokes. This explains the weak native separation without requiring global lighting, ambient occlusion, palette, texture opacity or brightness changes. The correction leaves body plaster/stone recipes, the 60% warm stone footing overlay and all metre UV spacing, phase and direction intact. Vertical closed-body and foot normals now point outward. Three's double-sided material already flips back-face lighting, so inward normals alone did not explain the previous weak contrast.

The previous source-derived physical anchors remain unchanged: both real side walls repeat from the rear with a two-cell margin and a three-cell rhythm. The sprite paints only its projected positive-axis faces. Its flat-source phase differs at 90°; using stable rotation-aware physical anchors on both walls is an explicit reference adaptation, not an exact screen-anchor match. This border-only cut makes no silent anchor change.

Every border remains within its actual intact support cell, with the same edited-corner shell fallback. Standing doorway crossings, window rays, slab and terrace heights, usable upper routes and blocked upper-cell retention are unchanged. Normal partial and full room disclosure removes the architecture group. No gameplay collision or shared material files change.

Validation: 46 focused nave, border, architectural-detail and fourteen-template support checks pass (10.14 seconds on the final concurrent run). They measure actual source stroke widths and pigments, physical edge capsules, outward normals, original texture phase and density, ordinary camera ray exposure, four compiled rotations, doors/windows/edited corners, low usable upper surfaces, real flat roofs and normal cutaways. The isolated proposal passes TypeScript. The four-path patch is based on `3965710a`. Clean live comparison of this follow-up remains pending parent integration; these checks do not establish final visual acceptance.
