# Room floor character

[Art records](README.md) · [Reference plan](../plans/tactical-reference-graphics.md)

Ground-room wood now has staggered plank-end joints, broad colour variation and
restrained entrance wear. These extend the existing semantic floor finishes,
wood grain, plank courses and continuous world-metre UV mapping. The matched
house views show clearer joints at 88 pixels. The finish remains quiet at the
normal 44-pixel scale.

| View | Before | After |
| --- | --- | --- |
| Ground room, normal 44-pixel scale | [Before](tactical-reference-2026-10-08/room-floors-before-house-44.jpg) | [After](tactical-reference-2026-10-08/room-floors-after-house-44.jpg) |
| Ground room, 88-pixel scale | [Before](tactical-reference-2026-10-08/room-floors-before-house-88.jpg) | [After](tactical-reference-2026-10-08/room-floors-after-house-88.jpg) |
| Upper office, normal 44-pixel scale | [Before](tactical-reference-2026-10-08/room-floors-before-upper-44.jpg) | [After](tactical-reference-2026-10-08/room-floors-after-upper-44.jpg) |
| Upper office, 88-pixel scale | [Before](tactical-reference-2026-10-08/room-floors-before-upper-88.jpg) | [After](tactical-reference-2026-10-08/room-floors-after-upper-88.jpg) |

The upper deck and hatch appearance stay preserved. These upper pictures prove
that preservation and review-route compatibility; they do not show a new upper
joint improvement. The upper deck uses its separate retained wood shader.
The new room floor plane remains at y+0.006. Furniture wood remains outside the
new room-floor variant. All rotations, admitted rooms, doorway clearance and
clipping around each climb opening stay exact.

The root browser review reports no errors. Subir, mouse movement to G7 on the
upper floor, keyboard Enter to G8, and Bajar complete. Mouse G8 selected the
observer; the Granadero HUD was then selected before the keyboard order. This
is a mixed input route. Saved photos show [ascent](tactical-reference-2026-10-08/room-floors-after-climb-playback.jpg),
[upper arrival](tactical-reference-2026-10-08/room-floors-after-upper-climbed.jpg),
[upper movement](tactical-reference-2026-10-08/room-floors-after-upper-walk.jpg),
the [open aperture and raised cover during descent](tactical-reference-2026-10-08/room-floors-after-descent-playback.jpg),
and [completed descent at ground G8](tactical-reference-2026-10-08/room-floors-after-descent-complete.jpg).

## Cost and checks

The change adds no triangles, final attribute bytes, building-floor batches,
geometry-cache entries, textures or texture lookups. It can add one cached
room-wood material/program variant. The room variant replaces that room's old
wood batch. Ordinary terrain wood can retain its separate material. The shader
adds bounded scalar work: five step comparisons, two fract calls, one each of
floor, mod, abs, fwidth, max and clamp, and two min calls. It adds no uniforms or
varyings. The accepted browser views show the compiled ground finish without
errors. GPU time was not measured.

Common world-position colour samples keep room-cell seams continuous. Rebuild
work is limited to the existing building-cache rebuild: six retained corners
per rectangle, common-coordinate samples and a bounded admitted-door loop.
The temporary colour attribute is 72 bytes per rectangle; final merged
attribute size is unchanged. Existing material textures remain byte exact.

House live counts remain 85 draws/126736 triangles close and
114 draws/71128 triangles at normal scale. Upper-office counts remain
81 draws/149388 triangles close and 86 draws/71819 triangles normal. Geometry
and texture counts also match the paired scenes. House has one loaded actor,
upper has two, with none pending. Short settled display samples are about
120 FPS; they do not measure GPU time or sustained performance.

The [native front](tactical-reference-2026-10-08/room-floors-native-front.png)
and [rear](tactical-reference-2026-10-08/room-floors-native-rear.png) sheets are
retained offline author views. They isolate joints and an open climb aperture.
They are separate from the actual root browser review.

The affected gate passed 73/73 tests. Typecheck passed in 14.741 s and production
build in 20.908 s. The final standard four-worker quick run passed 6,869/6,869 tests
in 904/904 selected files, with zero failures, skips or cancellations, in
2582.477 s. Eight standard-profile file exclusions are separate from test skips.
The build verified 1,377 export files and 1,045 asset references. No gate was repeated.

All 11,338 accepted repository input files, 10,427 non-doc/artifact source files
plus the engine state, 42,461 dependency entries and all pinned runtime files
remain exact before and after the gates. The production source is
`755475a0cd6e40c218f25b35802d00eabca94a35e75ccb176b086cc7f4c2f953`.
The runtime is Node 25.9.0, npm 11.12.1, Python 3.9.6, NumPy 1.26.4 and Pillow 11.2.1.
Runtime pin scope is explicit; system macOS libraries are outside the package
manifest. Root docs, links and ordered source equivalence receive separate
checks before publication after pieces 15–17.

The [review receipt](../../artifacts/room-floors/review-receipt.json) links the
saved live evidence, material-plane proof, cost, final gate and portable source
proof. The [read-only helper](../../artifacts/room-floors/verify-final-equivalence.py)
checks future root source, engine and production identity. Its strict option
also checks pinned dependencies and runtime inputs.

The installed root passed the [final equivalence proof](../../artifacts/room-floors/root-final-equivalence.json) and separate [engine-state proof](../../artifacts/room-floors/root-engine-state-proof.json) before publication. See the [delivery plan](../plans/tactical-reference-graphics.md) for its PR and merge state.
