# Rifle contact fit sampling review — 7 October 2026

This cut reduces repeated CPU work in the supported standing rifle-butt contact fit. It retains the same paid rules, supported contact recipe, strict arm reach, native grips, complete boot geometry, disclosed floor union, target resolver, and finite fallback. It does not change a character bank, a clip, a gameplay cost, a clock, or the actor's saved cell.

The source basis is the frozen rifle helper `39aa3b406af77de6e2864d580b00c2ce1327f17cabd33d8fec7e75d5abd65805`. The exact consumer is `75d8271d668f4010bf8e7155fbe75db329fb6cee776570af7f7d6f5e2d173465`, and the paid-facing presentation basis is `6ecdfa7147b12ad240198c8e379459c10fb33df1afd1314f8f3db6e3eff3bd43`. Their current rider, climbing, scene order, model identity and privacy behavior is retained.

## Changed work

The native attached boot path keeps each positive influence in its original order. It applies the same bind/inverse-bind coordinates, current bone matrix, homogeneous division, and weighted accumulation. Scalar arithmetic and two reusable Float64 coordinate buffers replace repeated Vector3 arrays. Detached or position-morphed footwear keeps Three's complete current deformation path.

A failed chronological two-hand boot-speed check records only its two adjacent native sample times. Each prepare clears that pair. A later candidate recomputes those two poses from its own body and foot recipe before spending time on its complete path. This rejects the same failure earlier. Every accepted candidate still runs the complete chronological 240 Hz path.

The independent probe verifies the accepted one-second path has exactly 241 chronological poses, 242 swept-floor checks including contact, 62 conservative body checks including contact, and 240 chronological boot-speed comparisons. A learned pair adds two preview poses and one comparison. It does not replace any chronological pose or gate. An occupied support hand retains exact native fallback at all 241 samples and completes once without reading a target.

## Equal geometry and admission

The independent frozen-to-candidate coordinate comparison covers both anatomies and all three detail levels: 264 full boot arrays and 222,288 actual vertex samples. Every batch coordinate, direct scalar solePoint coordinate and derived point-speed value is bit-exact to the frozen helper. A separate Three full-skin oracle differs by at most 3.974e−15 metres. The cases include native and genuinely fitted finite poses, native long-gun walking, transformed world parents, detached skin, changing relative and absolute morphs, restored attached caches, explicit projective homogeneous division, and reused or incorrect-size output buffers.

All 48 original LOD0 rifle pairings keep the exact same admitted plan and walking caps: six owned rifles, both native attacker anatomies, cardinal/diagonal and standing/crouched targets. Actual fitted bone positions, rotations, scales and matrices at the checked finite poses also match bit for bit. The paired receipt is [rifle-fit-performance-equivalence-2026-10-07.json](rifle-fit-performance-equivalence-2026-10-07.json).

The independent real 13-actor paid diagonal replay retains zero Root and boot jumps at prepare→contact, contact→impact and impact→result; zero intended wrist clamps; 2.651445 m/s maximum actual complete-boot speed; one completion; and the same finite result. It uses the normal 0.12-second idle blend and current actor order. This is a CPU geometry replay, not a browser screenshot or a frame-rate acceptance.

## Paired timing

All times below are milliseconds. These are same-process fresh per-model fits, with alternating evaluation order. Host load is uncontrolled. Wall and total process CPU are separate measurements; process CPU can exceed wall time because it includes runtime worker/garbage-collection work.

| 48 pairings | Frozen wall | New wall | Frozen CPU | New CPU |
| --- | ---: | ---: | ---: | ---: |
| Median | 210.971 | 159.697 | 162.222 | 120.088 |
| p95 | 728.876 | 474.345 | 334.926 | 270.077 |
| Maximum | 790.425 | 532.904 | 504.591 | 320.385 |

A separate same-process real 13-actor paid prepare comparison measured the isolated helper:

| Actor and order | Frozen wall | New wall | Frozen CPU | New CPU |
| --- | ---: | ---: | ---: | ---: |
| Male cardinal | 159.870 | 116.945 | 304.989 | 224.270 |
| Male diagonal | 313.247 | 203.254 | 413.877 | 286.849 |
| Female cardinal | 132.597 | 112.854 | 204.259 | 160.822 |
| Female diagonal | 282.718 | 181.936 | 310.902 | 191.148 |

A separate loaded first-process 13-actor run still took 1476.836 ms wall / 673.725 ms CPU for its whole first prepare scene, and 348.216 / 168.054 ms at contact revalidation. The earlier frozen run took 1214.817 / 946.848 ms at prepare on a different load. Those two wall times are not a paired speed comparison.

## Remaining limit

The fit is synchronous. It still exceeds a normal frame budget, and a cold first strike can delay the main thread. This cut is a bounded CPU/allocation improvement; it does not establish smooth frame delivery or full body polish. Moving the plan to a worker or sliced prewarm requires a separate design for current admitted model/floor revalidation, finite phase clocks and uninterrupted body motion. No asynchronous admission or paid simulation delay is introduced here.

The unchanged physical rifle cut already records the remaining native source acceleration corners. This performance cut does not repair or hide those source motions.

## Local checks

- Two stageable boot-skinning/admission tests pass. They use real exported geometry, both anatomies, all three detail levels and Three's independent complete skin path. They also assert the actual accepted chronological suffix and finite occupied-hand fallback.
- The frozen/candidate 48-pair comparison passes with exact plans, gait caps and sampled fitted bones.
- The independent coordinate and real paid geometry probes pass with source/bank pins checked at both ends.
- All 58 affected existing checks pass: strict sabre/pistol, sole cache, runtime, rider seat, paid facing and current scene order. The focused run took 112.88 seconds on the loaded host.
- The exact saved helper/consumer/presentation project type check passes.

No animation bank, manifest or profile changes belong to this cut.

## Integrated ordinary combat review

The parent integration passes 15 affected scalar-skinning, chronological-admission, sole-cache, sabre/pistol-contact and real paid-rifle checks in 53.84 seconds. TypeScript, documentation and all 38 baseline audits pass. Initial static export `8ba27d79e676` verifies every route, 1,244 files and 1,039 asset references.

Four normal paid browser cases pass on source `627ea15c82171fe75f2e7be2b32be316bf597526`: cardinal/diagonal rifle strikes for both bodies. All 88 captures have no browser errors. Each strike retains the owned rifle, loaded round, pocket ammunition and supplies, spends 4 displayed PA, applies 18 damage once and completes at its saved cell. Selected live contact and recovery poses were compared with the preceding accepted physical views and current sprites. This confirms retained visible action behavior; screenshot telemetry does not establish a frame budget.

Publication source `b46e89920ac9310e2e8054298316fb1bc5198db2` includes the posta correction from PR #241 and retains every captured actor/helper/native hash byte for byte. Its type check and combined static export `6df69babc7d6` pass. `artifacts/three-rifle-scalar-sampling-cut-review/` records the actual capture source and publication bridge. First-fit main-thread responsiveness remains an explicit separate task.
