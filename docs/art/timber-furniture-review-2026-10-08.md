# Timber furniture construction

[Art records](README.md) · [Reference plan](../plans/tactical-reference-graphics.md)

Tables and benches now have separate boards, narrow joints and edge rails.
Timber chests have hollow bodies, board lids, battens, hinges, straps and handles.
The open lid rises away from the body. It exposes the cavity in the matched live
views. The old negative hinge angle placed the lid inside the chest.
Small joints and hardware are quiet at normal scale and clearer at close zoom.

| View | Before | After |
| --- | --- | --- |
| Normal scale, nominal 44-pixel actor | [Before](tactical-reference-2026-10-08/timber-furniture-before-44.jpg) | [After](tactical-reference-2026-10-08/timber-furniture-after-44.jpg) |
| 2x scale, nominal 88-pixel actor | [Before](tactical-reference-2026-10-08/timber-furniture-before-88.jpg) | [After](tactical-reference-2026-10-08/timber-furniture-after-88.jpg) |

Both previews use the expanded house fixture, initial guard position I7, the
default camera and paused daylight at 12:01. The before copy differs from the
private final candidate only in the two timber source/test files. The fixture
provides both an open chest and a closed chest. Ordinary I7→I8→I9 orders complete;
the guard stands [beside the open chest](tactical-reference-2026-10-08/timber-furniture-movement.jpg).
There are no browser errors. A later ordinary order through the open door to H12
also completes.

The compact Mobiliario button now opens a six-room house review. Its initial
state uses ordinary movement and door orders to reveal each room. The exterior
variant admits no hidden interior props. Tests cover the route, room admission,
closed and reopened doors, and removal of previously admitted contents. The old
seven-prop outdoor fixture remains available in the larger sandbox. No renderer
or disclosure override is used.

## Geometry and cost

| Prop | Prior triangles | Typical new triangles | Tested cap | Material batches retained |
| --- | ---: | ---: | ---: | ---: |
| Table | 120 | 192 | 216 | 2 |
| Bench | 72 | 120 | 144 | 1 |
| Chest | 72 | 516 | 528 | 3 |

Closed height, horizontal footprint, hinge side and all four rotations remain
exact. Stone furniture keeps solid slabs. A measured 0.8 m chest stays 0.8 m
closed. Its open visual height changes from 0.762 m to 1.373 m; the horizontal
lid projection stays inside the authored footprint. Gameplay obstacle height
and saved open state remain authoritative. Illumination is applied once to the
new parts. The seven-prop geometry fixture changes from 3,288 to 3,852 triangles
and retains six material batches.

The live normal view changes from 65,820 to 67,272 submitted triangles and keeps
113 draw calls, 108 geometries and 43 textures. The close view changes from
122,716 to 123,724 triangles and keeps 85 calls, 101 geometries and 28 textures.
One actor is loaded, with none pending. The settled displays show 119.8–120.2 FPS.
These short display readings do not measure GPU time or sustained performance.

The fixed private quick gate passes 6,823/6,823 tests across
896 selected files in 2,149.115 seconds, with four workers
and the standard quick selection. Typecheck and production build pass, with
1,377 export files and 1,045 verified asset references. Every 10,416 non-document
input, engine gitlink, dependency file and production source identity
`de26db679503` matches the ordered root candidate. The gate uses Node 25.1.0,
npm 11.6.2 and Python 3.9.6. A read-only proof uses those same pinned executables;
the default root shell has Node 25.9.0 and npm 11.12.1. No gate was repeated for
that shell difference. Private and root Git revision metadata differ.
Root docs, links and staged diff checks pass separately. The [review receipt](../../artifacts/timber-furniture/review-receipt.json)
links the geometry, counters, source proof and final gate results.

```sh
npm run test:quick
npm run typecheck
npm run build
npm run audit:docs
git diff --check
```
