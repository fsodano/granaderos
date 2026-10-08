# Standing gesture: supported changed-hand return

The previous bounded floor/contact repair keeps the incoming toe contacts planted during healing, ground collection and self release. Its automatic left-pistol-to-right-pistol return still moves a grounded sole at 2.991 m/s. This follow-up lifts and lands each foot before the other moves. It retains every native Root, pelvis, upper-body, position and scale channel, the body dimensions, the paid/native cue clocks and the saved world cell.

## Bounded consumer

Only the existing nine standing guards and three supported standing gestures are admitted. Ordinary returns retain their 120 ms duration. A return whose actual incoming and pure-native endpoint forefeet differ horizontally by more than 20 mm uses two 240 ms steps. This 480 ms leg-only return does not delay the 300 ms paid phases, the 1.4 s unphased gestures, cue completion or the existing 120 ms mixer fade.

The endpoint comes from the exact native clip/bind/phase, including the complete weighted boot minimum and actual forefoot matrix. The first foot is the foot that supports the native destination. Its horizontal travel and rotation occur between the lifted portions of the path. It lands before the other foot lifts. The knee bend direction rotates within the actual leg plane; a direct knee-point interpolation can cross the leg axis and turn the upper boot shaft sharply. The shaft uses thigh and calf skin weights and therefore must participate in the motion check.

The extra local ankle bound is 200 mm only during a stepping return or a paid gesture that resumes that step. The measured maximum is 193.492 mm. Ordinary incoming contact remains bounded at 130 mm. Extra heel roll remains bounded at 0.07 radians; the measured maximum is 3.513 degrees. The original native segment lengths stay within one micrometre. No model, root or pelvis translation/scale is applied.

## Physical evidence

All measurements use the actual complete weighted footwear, both anatomies and all three LODs.

| Measure | Result |
| --- | --- |
| Complete weighted boot floor across all tested normal routes | At least 1.976 mm above the saved floor |
| Supported step | At least one complete weighted boot within 3 mm of the floor on every step frame |
| Grounded mirrored-return sole speed | At most 1.619 mm/s, down from 2.991 m/s |
| Fixed incoming forefoot position error | At most 1.882 micrometres |
| Incoming 240 Hz numerical contact speed | At most 0.452 mm/s |
| Mirrored complete boot endpoint at a 0.0625 ms remaining interval | At most 0.505 micrometres from native |
| Dense 240 Hz complete boot speed, compressed healing | At most 7.109 m/s; unchanged source reaches 4.478 m/s |
| Dense 240 Hz complete boot speed, ordinary unphased playback | At most 4.630 m/s; unchanged source reaches 1.876 m/s |
| Fitted reach error | Zero in admitted normal cases |

The full speed bounds are retained from the previous contact cut. The compressed peak belongs to the retained incoming native body motion; this cut repairs the return and does not retime that body motion. Ordinary nine-guard pose comparison covers 4,860 frames and 257,580 bone rows: native/non-leg channels are bit exact, and the largest leg quaternion component difference from the predecessor is 3.51e-14.

The expanded mirrored matrix uses actual heal/loot/free cues, all three first-frame arrivals (0/16.7/33.3 ms), 60/120/240 Hz, both anatomies and all LODs. The dense matrix also includes 30 Hz. Complete footwear dimensions, source clocks, markers, world position and body orientation remain unchanged.

## Validation and preserved failures

The combined affected run covered 205 checks: 199 passed and six expanded mirror cases failed the earlier 0.4 mm/s numerical velocity threshold. The measured maximum was 0.452 mm/s. The final contract independently checks the actual immutable world contact within two micrometres. Two adjacent errors at 240 Hz give a derived 0.96 mm/s velocity bound. The six revised cases and six interruption-record cases then passed in a separate 12-check run. No helper behavior changed between these runs. The final current integration checkout passes all 205 focused checks in 196.422 seconds, and all 188 affected worker/runtime/gait/prone/garment checks in 49.491 seconds. TypeScript, native library, locomotion profile, documentation and all 38 baseline checks pass. Production export `a2072de717a3` verifies 1,245 files and 1,040 asset references.

The 120 ms stepping experiment reached 9.26 m/s, and the 240 ms experiment reached 9.253 m/s. Those failed polish attempts remain in the frozen evidence. They are not acceptance results. The earlier failed 115-check low-slip run also remains in the predecessor package.

The committed-source consumer hooks are composed by `tools/characters-3d/install-gesture-contact-runtime.py`. For an existing bounded consumer, this changes only the apply hook to pass the actual action time scale. The installer proves that all other runtime bytes remain unchanged. It also supports the original seven-hook installation and the older floor-only signature. Preserve the current runtime and use this installer; do not replace newer source with the reference snapshot.

## Interruption limit

A new paid cue during a step preserves the actual forefoot endpoints within 0.588 micrometres, retains the floor and native lengths, and smoothly resumes contact. Thirty cases cover return delays of 40/120/240/320/440 ms across both anatomies and all LODs. Invalid rates cancel without a partial pose or a weighted scan.

The existing mixer stops its earlier fading action when the new action starts. That changes native Root/pelvis/upper channels at the same timestamp. Complete weighted shaft movement can still reach 26.251 mm at that interruption; the unchanged raw source reaches 54.760 mm. This cut preserves those native channels and does not claim continuous whole-boot motion for that case. A mixer/source handoff repair remains necessary before complete interrupted-motion acceptance. Uninterrupted stepping return has no finite endpoint pose jump.

## CPU workload and limits

The new measured workload uses real left-hand aim cues, real 300 ms paired healing, automatic right-hand returns and another ordinary left-hand aim. It tests 16/40/100 actors, both anatomies at LOD1, 360 frames at 60 Hz, 96-frame cycles, the first 30 frames excluded from warm statistics, actual actor ticks, world matrices and footwear skeleton updates. All actors enter and step together. The disabled control retains the same ordinary source work. No test or typecheck ran concurrently with this measurement.

| Actors | Fitted p95 | Fitted maximum | Helper p95 | Disabled p95 |
| --- | --- | --- | --- | --- |
| 16 | 1.848 ms | 11.271 ms | 1.261 ms | 0.622 ms |
| 40 | 4.605 ms | 6.423 ms | 3.264 ms | 1.770 ms |
| 100 | 11.643 ms | 13.476 ms | 8.037 ms | 4.493 ms |

All measured fits succeed and retain complete weighted scans. This is a CPU measurement for this specific workload. It is not a GPU or sustained frame-rate claim. The broader predecessor workload had 100-actor p95 up to 33.095 ms and maximum 49.582 ms; those limits remain recorded and are not erased by a different workload. Per-frame vector/quaternion allocations remain a separate performance follow-up.

## Normal paid review

Use the published `Vendas, recogida y liberación` scene and the ordinary HUD controls: `Vendar` (`heal`), ground collection (`lootBatch`, rendered as `loot`) and `Liberarse` (`free`). Medical playback has real 300 ms prepare/result phases. Ground pickup and release retain the unphased native duration. The fixture uses owned dressings, a valid injured adjacent ally, real ground items and actual boleadoras entanglement. Private pose injection is not an acceptance route. The integration checkout passes six before and six after normal HUD routes, with 144 captures, exact source and served bank hashes, no browser errors, and identical AP, cells and owned inventory. The baseline actor differs only by the already merged worker readiness hooks, which do not apply to these gestures. These rifle-equipped routes exercise ordinary contact and return; the changed-hand stepping matrix is independently covered by the focused physical checks. Local evidence is retained under `artifacts/three-gesture-step-return-current-review/`.

No native bank, garment, architecture, gait or rifle-contact source file is included in this cut. Every earlier frozen cut remains unchanged.

## Held clock and current publication

Six additional current integration checks pass for both anatomies and all three
LODs. They use the actual idle accessibility hold, pause during the step or
through its endpoint, then resume. The complete boot minimum is 1.980860 mm,
endpoint speed is at most 0.121116 mm/s, and all source/world/clock channels
remain exact. The unchanged helper stays at `02724726`; the current runtime
`9cb41d90` differs from released worker runtime `474212b4` only by the actual
action time-scale argument. These test and documentation additions change no
tested implementation or asset bytes.

The ordinary selected fire cursor uses the right guard. Left-pistol aim occurs
in offhand firing preparation, while the HUD blocks new orders during that
presentation. An immediate left-aim-to-gesture sequence is focused physical
coverage; it is not a currently reachable normal HUD acceptance route.
