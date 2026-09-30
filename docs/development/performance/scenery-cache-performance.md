# Scenery cache and 60 FPS work

## Current native-density cache

Scenery now uses native screen density, independent of camera zoom. Zoom scales
the cached picture instead of rebuilding every texture. Detached SVG sources
are released after preparation. Normal 100% detail is unchanged; magnified
buildings and ground can look softer above 100%. Actors and effects retain
their existing rendering. This supersedes the zoom-resolution work below.

The production forest test now passes during movement immediately after zooming
from 300% to 100%. Both daylight and night record 518 moving frames, maximum
10.3 ms, and zero frames above 16.8 ms. The baseline had 24 slow frames and a
48.4 ms maximum. All 202 cached image references survive the zoom and walk;
the cache stays at 79,646,810 pixels instead of rising to 153,161,634 at 300%.
Thirteen rendering tests, typecheck, and production build pass.

These are movement measurements on this machine. Cold loading, large combat,
moving lights, room reveals, and the zoom-click frames remain separate acceptance
checks. Full-game locked 60 FPS is not established.

## Latest forest and zoom validation

Production walking at 100% zoom now meets the movement frame budget in the
sampled city and forest scenes. The final six-soldier night forest walk records
519 moving frames, mean 8.33 ms, p99 10.1 ms and maximum 10.4 ms. Daylight forest
movement has the same mean, with maximum 10.3 ms. No long tasks occur in either
sample. These are movement results: the forest move start still takes a 25 ms
frame. Rapid zoom from 100% to 300% and back improves from a 91.7 ms maximum
and a 96 ms long task to a 33.2 ms maximum with no long tasks. Locked 60 FPS
across every interaction is **not** established.

Forest fading previously rebuilt large scenery images. Woodland now uses its
small original image assets separately from the depth caches, with viewport
culling and the same opacity, depth and lighting. Daylight omits a redundant
brightness filter. At night, exact shaded textures are shared through a bounded
32-entry cache; live filters remain the fallback while a texture is prepared.
A regression test checks that living soldiers soften nearby trees, trees become
opaque after they leave, and dead soldiers do not soften foliage.

Bounds, cloning and definition lookup now run in the raster work queue. Zoom
reuses detached prepared scenery sources, retains sharper images when zooming
out, and waits 300 ms for zoom input to settle before preparing a new density.
This avoids putting the complete vector scenery back into the live page.

The fixture separates route preparation from the measured command, starts
sampling before the command, and reports both movement and whole-window frame
times. Its output has a fixed height to avoid changing the field layout.
Twenty-four focused rendering tests and typecheck pass. Large combat, moving
lights, cold loading and other hardware still need performance coverage.

## Earlier measurements

The 60 FPS target remains active. After scenery caching and tile-control reuse,
the repeated 100% zoom night walk averages 119 FPS with the camera following the
selected soldier. Its p95 is 9.3 ms, p99 is 10.3 ms, and maximum movement frame is
16.8 ms. Reusing tile elements removed the repeatable 83 ms camera-boundary pause.
A further daylight walk averages 119 FPS, with p99 10.3 ms and maximum 18.1 ms.
This does **not** prove locked 60 FPS across the game: the move-order calculation
still produces a 195 ms main-thread task before animation starts. Cold loading
and larger combat scenes remain to be measured.
A later repeat after bounded move-order search and obstacle indexing averages
117 FPS, but records a 58.7 ms movement frame and a 223 ms pre-animation task.
The isolated movement calculation improves from 25–34 ms to 7–13 ms in Node;
this does not establish an improvement to the browser slow-frame tail. Sixty
focused movement/rendering tests pass.
See [exact measurements](../../evidence/frame-rate-2026-09-22.json).

## Route-search profile follow-up

The stable minimum-cost heap and per-search terrain cost cache preserve all
routes and costs in 32 direct comparisons across Buenos Aires, San Lorenzo,
Mendoza and Uspallata, both modes and four movement types. Combined search time
falls from 325 ms to 200 ms in that Node check; 68 focused tests pass.

Browser instrumentation now separates search, command and React rendering.
At 100% zoom on the same night route, search takes 17.5 ms, the move command
9.3 ms, and the first battlefield render 128.7 ms. The profiled run has 505 moving
frames averaging 8.55 ms, p99 16.7 ms, maximum 58.4 ms, and a 212 ms pre-animation
long task. The fixture includes React Profiler overhead. This identifies the
initial battlefield redraw as the next target; it does not prove steady 60 FPS.

## Ground-control reuse follow-up

Moving a soldier no longer rebuilds every ground control. Base tile elements
retain identity; occupied labels replace only the few affected elements, and
the sight overlay is drawn separately. The first battlefield render falls from
128.7 ms to 29.5 ms in the profiled 100% night walk. The pre-animation long task
falls from 212 ms to 99 ms. Across 510 moving frames, mean is 8.48 ms, p99 is
10.4 ms and maximum is 50 ms. These spikes still fail steady 60 FPS acceptance.

Thirty-six rendering/control tests and typecheck pass. Live checks verify the
old tile regains its accessible label, the new tile names its occupant, Enter
moves back through the reused control, and V still shows the sight overlay.
Temporary scene profiling and the test route are removed after measurement.

## Production validation and asynchronous raster conversion

Full-page DOM/AX inspection during measurement was adding a repeatable 58–67 ms
frame spike. Observe only the small status output while sampling, and collect
full page state after the eight-second window. A production night walk without
that interference records 519 frames, maximum 10.4 ms, and no frames over the
16.8 ms measurement threshold. This is a narrow movement result, not full-game
acceptance.

Daylight then exposed a separate, repeatable one-second stall. Long-frame
attribution identified a `BlobCallback`; fine-grained timing found synchronous
blob URL creation taking 0.7–1 second. Asynchronous FileReader data URLs remove
that stall. The daylight repeat has 517 frames, p99 9.9 ms, maximum 33.2 ms and
one frame over budget. The night continuation has 517 frames, p99 9.8 ms,
maximum 16.7 ms and no frames over 16.8 ms. Pre-animation tasks of 141–150 ms
remain in these scenery-changing runs, including fixture route-selection work.

Decoded cache layers now remain mounted at exact actor-depth ties, hidden while
individual scenery members interleave in their original order. All 175 sampled
image references survive the walk. Twenty-two rendering/terrain tests and
typecheck pass; visual review preserves buildings, texture and roof cutaways.
The temporary production test route and diagnostic timing logs are removed.
The walking-image preload and vector-ground experiments did not fix the stall
and are not retained.

## Implementation

Noninteractive buildings and ground scenery are cached as transparent PNG images at its original
depths. Actors, ground controls, overlays and effects remain live. Exact depth
ties retain the original object-key ordering. Texture files and referenced SVG
definitions are embedded before rasterization; brightness, furniture, roof
cutaways and wall details are preserved.

The cache belongs to world geometry, not the camera viewport. Scrolling no
longer discards and rebuilds every cached image at a culling boundary. Terrain
controls remain viewport-limited. Their React elements and obstacle labels are
prepared once per relevant state change, then reused as the camera scrolls. Static source vectors exist only while new geometry
needs preparation; keeping hidden vectors permanently proved expensive.
Unchanged serialized layers reuse their existing image after state changes.

Zoom keeps the current image visible while preparing the new resolution from a detached source. Image
preparation is queued in idle slots and decoded before publication. Cancelled
work cannot replace newer geometry. Image references are released on replacement or unmount. SVG and PNG
conversion uses asynchronous data URLs; creating blob URLs produced measured
synchronous stalls in the in-app browser. Texture failures retain the original vector rendering. Density is
bounded to three physical pixels per world pixel and each layer to 16 million
pixels. The measured night cache holds about 70 million raster pixels; memory
and first-load cost need further work alongside frame-time spikes.

## Verification

- 167 rendering tests pass, plus typecheck and the production build (960 static
  files and 856 verified asset references). The regional rendering test now
  checks bounded world-depth cache layers and viewport-only hit targets rather
  than requiring every static source decoration to be viewport-limited.
- Live checks confirm pointer tile movement, Enter activation, day/night
  lighting changes, room reveals, furniture, and camera tracking.
- The temporary browser test route was removed after measurement. The fixture
  remains in `tools/performance-fixtures/frame-rate-check.tsx`. To repeat, copy it
  to `web/app/performance-check/page.tsx`, run the development server, select
  100% zoom and the camera-centering control, wait for cache preparation, and
  select Prepare route, then Measure walk. Forest scene selects the six-soldier woodland check; Measure scene captures zoom input without issuing a move. It uses an isolated battle and does not write campaign
  saves. Remove the temporary route before publishing.

## Remaining acceptance

Reduce the slow frame tail, measure cold loading and rapid zoom changes, and
verify large battles, forests, moving lights and production builds. Do not
close the 60 FPS requirement from an average alone. Full gameplay and equipped
blade artwork also remain incomplete.

## Zoom cache memory follow-up

After zoom settles, oversized layers now return to the required density. The
202-layer night forest cache falls from 153,161,634 pixels at 300% to
79,646,810 at 100%, a 48% reduction. Images whose physical size is unchanged
by the pixel limit are reused; the capped ground image identity was verified
across zoom. The existing image remains visible during asynchronous replacement.

The final warm walk passes: 519 moving frames, mean 8.33 ms, maximum 10.4 ms.
Immediate movement during replacement still has 28 frames above 16.8 ms and a
49.7 ms maximum. No long tasks were recorded in that sample. Delaying all
replacement until movement stops did not improve the tail and was removed.
This is a memory reduction, not evidence of locked 60 FPS. All 23 focused
rendering checks and typecheck pass.
