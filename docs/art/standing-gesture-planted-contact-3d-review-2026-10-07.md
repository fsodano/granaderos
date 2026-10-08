# Standing reach gestures: planted contact — 2026-10-07

This separate runtime cut repairs the measured horizontal foot slip during standing healing, ground collection and self release. It follows the named native heal/pickup/free source repair. It does not replace that source repair or the frozen floor-only evidence.

## Real action timing and route

Medical playback presents a 300 ms preparation and a 300 ms result with one cue ID. Both phases retain their actual source time mapping. Ordinary paid ground collection and self release use unphased cues and the native 1.4 s duration. The renderer maps the paid `loot` presentation to `stand.gesture.pickup`. Each transition retains the existing 120 ms mixer fade. No event, target clock, simulation command or completion time changes.

The ordinary browser review uses a compiled battle, owned supplies and valid targets: `heal` with `unitId`/`targetId`, `lootBatch` with `unitId`/`items[{groundId,count}]`, and `free` with `unitId`. The medical control selects an injured reachable ally; the ground equipment control collects a reachable visible stack; “Liberarse” releases the actor from actual held boleadoras. `pickupEquipment` is an inventory-cursor operation and is not this paid ground action. Parent owns the playable “Vendas, recogida y liberación” fixture and its visual review. CPU pose checks alone are not normal-gameplay browser acceptance.

## Bounded physical change

Admission is limited to the three reviewed standing native gestures and nine guard families: idle unarmed, long gun, short gun, blade, knife and lance; long-gun and short-gun aim; long-gun brace. The actual left-hand mirrored pistol-aim entrance is also checked. The gesture must carry `complete-native-boots-all-lods` evidence. All source banks remain outside this runtime cut.

Only thigh, calf, foot and ball rotations on each leg may change. The fit retains every native joint position, scale and segment length, Root/pelvis/upper channels, the saved world cell, yaw and paid/source/mixer clocks. It restores those eight native local rotations before each mixer sample. The other gait, melee, climb, rider and action consumers remain in their existing positions.

A complete weighted footwear scan checks each fitted leg, including the shaft, heel, toe and sole. The true forefoot anchor uses actual native sole vertices; constructor checks that the 48 real sole vertices per foot have the required foot binding. It does not approximate support from the ankle or use an empty absolute height band. The captured forefoot X/Z target remains immutable throughout the gesture. Its height and sole orientation settle with quintic easing, then return to the current native guard endpoint over the retained 120 ms fade. A small heel roll keeps the ankle reachable. The local limits are 130 mm of leg-only stance adaptation and 0.07 radians (4.01 degrees) of extra heel roll. The source 2 mm straight-leg reserve is introduced smoothly; return approaches the native solver's 0.4 mm reserve.

The return endpoint cache contains only immutable local source results keyed by exact native clip, binding, geometry and phase. It never caches an actor's world target or fitted pose. A cue that arrives before the first rendered frame samples its actual incoming guard clip rather than using the bind pose. Invalid clocks, changed world placement, non-unit scale, malformed boots and unreachable/excessive fits cancel atomically to native transforms. An authored world-cell change is preserved when it cancels the fit. Ordinary rest and unrelated actions perform no weighted boot scan.

Quintic targets do not imply that complete weighted motion is C2: the actual Root/pelvis and linear mixer fade remain unchanged. The measured complete-surface speeds below remain explicit.

## Measured checks

The retained core matrix covers both anatomies, all three LODs, all nine guards and all three compressed paid gestures with first-frame arrivals of 0, 16.67 and 33.33 ms. This is 972 entry/return handoffs. The ordinary unphased loot/free matrix adds 648 handoffs with the same anatomy/LOD/guard/arrival coverage. Left-hand pistol tests add normal medical/loot/free routes and all three arrivals. Thirty-six dense continuity groups include all guard families plus the actual mirrored pistol at 30/120/240 Hz, reduced-motion return and zero-delta handoff. Separate checks cover immediate first cues, held time, finite fallback, interrupted actions and changed placement.

The original source-only/floor-only snapshots remain unchanged. The complete named channel bytes and native times for the 24 relevant current male/female clip records match the validation banks exactly. No private bank is a release file. Root must integrate this cut by its current runtime hooks and use current published banks.

The combined final gate passes193 checks in118.29 seconds:115 bounded-contact tests and78 retained floor regressions. TypeScript passes with no emit. The compressed raw minimum is−50.362 mm; all fitted complete boots remain at least+1.976 mm above the actor floor. Maximum leg-only stance adaptation is124.480 mm, extra heel roll3.513 degrees, actual weighted forefoot error1.052 micrometres and straight-leg reach error zero. Forefoot X/Z speed is at most0.213 mm/s at240 Hz. The ordinary nine-guard near-ground outline maximum is47.904 mm/s against raw1.158 m/s. Complete paid boot speed peaks at5.183 m/s against raw4.338 m/s at60 Hz. The dense matrix, including mirrored pistol aim, peaks at7.109 m/s against raw4.478 m/s at240 Hz; ordinary unphased playback peaks at4.630 m/s against raw1.876 m/s. These are bounded complete-surface speeds, not claims of unchanged motion.

**Known mirrored-return polish failure remains:** the initial115-test run had109 passing checks and six failures of a60 mm/s all-return ground-outline requirement. All three LODs reproduce2.991 m/s male and2.983 m/s female when the left-hand aim entrance returns to ordinary right-hand aim after the hand cue clears. That source stance changes during the same120 ms fade. Gesture entry/contact is14.077 mm/s male and26.338 mm/s female near the ground, with the forefoot planted. The release candidate keeps the original failed log/metrics and records this remaining limit. Its bounded regression checks entry contact, support, all preserved channels/clocks and return continuity. Return surface speed must remain within the independent rigid-sole envelope: actual forefoot translation plus2r·sin(Δfoot rotation/2), using each native sole's measured lever radius and a small float tolerance. The measured return envelope is4.151 m/s. This checks for an extra surface jump; it does not turn the failed low-slip polish requirement into a pass. A separate planted/stepping return across that real hand change is still required. Full weighted return also converges toward the exact native endpoint as the remaining real interval halves from 4 ms to 0.0625 ms (2.881 mm to0.0452 mm maximum); this checks for a fixed expiry jump rather than imposing an unrelated arbitrary displacement at a finite interval.

## CPU workload and limits

The benchmark uses actual ActorRuntime updates/ticks, complete scene matrices and boot skeleton updates, both anatomies at LOD1 and the nine ordinary guards. It includes cue dispatch/forecast plus the owned begin/restore/apply cost. All actors enter together. Each run has 360 frames at 60 Hz, with the first 30 omitted from warm statistics. The compressed workload has 54-frame cycles and retained paired 300 ms phases. The ordinary workload has 108-frame cycles: paired medical playback and native 1.4 s unphased loot/free. Disabled controls retain the same actor and mixer work. Construction and the first eight frames are retained separately.

| Actors | Idle p95 | Compressed active p95 | Ordinary active p95 | Ordinary helper p95 | Ordinary maximum | Ordinary cold maximum | Ordinary construction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 16 | 0.899 ms | 5.233 ms | 3.301 ms | 1.985 ms | 6.156 ms | 5.017 ms | 81.618 ms |
| 40 | 2.558 ms | 6.211 ms | 4.996 ms | 3.665 ms | 6.137 ms | 7.026 ms | 151.324 ms |
| 100 | 9.687 ms | 33.095 ms | 17.693 ms | 12.727 ms | 44.473 ms | 30.126 ms | 457.969 ms |

Idle has zero weighted vertices processed. All enabled active fits have zero rejections.

This is a defined actor CPU workload. It excludes GPU rendering, full clothing/horse content, terrain, the tactical worker and end-to-end gameplay. The 100-actor workload and cold allocations remain performance limits. The final run has100-actor compressed p95 of33.095 ms and maximum49.582 ms; ordinary active p95 is17.693 ms and maximum44.473 ms. These exceed a16.67 ms frame budget. The earlier run was faster (ordinary p9513.020 ms), so these are host-dependent samples, not a performance guarantee. These results do not establish sustained 60 FPS or complete body-motion acceptance. Normal-scale paid browser review remains necessary.

## Safe composition

The reference predecessor runtime is SHA-256 `17d952734d6fca1c9eca06a45b565576e3409f17a402e806db9ed132c0049ad8`. The controlled installer adds only the seven gesture hooks, or upgrades the existing floor hooks' two call arguments. It verifies that removal/reversal of those exact hooks reproduces every other byte of the current input runtime. It rejects missing or duplicate anchors. Do not copy the frozen whole runtime over a newer runtime.

The gait helper stays `2f42bb24bf93812af3f526bd32bf5fe0aafcea2eddf29d57313f024a61f2b312`. The separately owned scalar melee helper used in CPU proof stays `79236396011afc08d23cc7e933da809aa5082036495a778f720baf75d69e7774`; it does not admit these gestures. Neither helper belongs to this cut. Existing physical rifle selection is retained.

From the repository root:

```sh
GESTURE_CONTACT_METRICS=/tmp/gesture-contact-metrics.json node --test tests/three-gesture-planted-contact.test.mjs
node --test tests/three-gesture-blend-support.test.mjs
node tools/characters-3d/review-gesture-blend-performance.mjs /tmp/gesture-contact-cpu.json
python3 tools/characters-3d/install-gesture-contact-runtime.py web/lib/three/actor-runtime.ts --output /tmp/reviewed-actor-runtime.ts
```

Review the generated narrow runtime diff before applying it. The fallback regression tests deliberately omit a clip argument so they continue to test the retained floor-only path; the separate planted tests exercise the real supplied clips and phase clocks.
