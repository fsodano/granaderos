# Human character library review — 7 October 2026

The library contains eight human appearances, three mesh detail levels per appearance, and 334 semantic clips in each native anatomy bank. The accepted view is isometric. The lab opens the current game Granadero, with pixelation off and the accepted playback pace (the former 1.25× is displayed as 1×).

## Appearance

| Character | Retained identity |
| --- | --- |
| Granadero | Navy coat, red facings, cream crossbelt, brass shako plate and red cords |
| Realista | Light uniform, red facings and cockade |
| Trabajador | Earth-colored shirt and waistcoat |
| Cirujano | Dark coat, linen cravat and brass buttons |
| Gaucho | Fitted poncho, red scarf and felt hat |
| Fraile | Habit, rope belt, folded hood and tonsure |
| Exploradora | Green shirt, trousers and continuous braid |
| Mujer con rebozo | Light blouse, burgundy shawl, skirt and hair bun |

The earlier pass corrects open hairlines, collar seams, sleeve cuffs and cloth detail. The user requested a further face pass because the Granadero still looked like a toy. The new source uses clean CC0 young male and female skin maps from the MakeHuman system pack, at 2048 pixels. It retains local color variation, adds spatial roughness, and derives restrained normals from fine source grain. Aksel is no longer used by the current appearance source. Faces retain the native human surface and UVs; selectable skin color, female proportions, bind poses and clothing parts remain intact. **This new face pass is not yet visually accepted.**

Poncho openings allow the arms to pass beside the torso. Long garments have separate crouched, face-down and face-up shapes. Coat tails flatten under a fallen body rather than lifting the body above the floor. Military crossbelts share seam vertices and native skin weights with each reduced coat, so the shoulder strap follows the actual cloth at all three detail levels. These are authored cloth corrections, not a cloth simulation.

## Motion and contact

Each anatomy has the same action coverage:

| Posture | Clips | Main action families |
| --- | ---: | --- |
| Standing | 106 | Armed travel, shooting, cuts, thrusts, blunt strikes, loading, work, climbing and artillery |
| Crouched | 86 | Supported travel, firearm and blade actions, work and recovery |
| Prone | 63 | Crawl, firearm actions, work and posture changes |
| Mounted | 79 | Riding, weapon actions, loading, falls and recovery |

The reviewed loading set contains 76 rifle/pistol clips per anatomy, including shared bindings, six rifle profiles, three pistols, the second pistol barrel and four postures. Other maintenance actions, including priming and repairs, are separate clips. Appearance changes share the relevant anatomy bank rather than copying or scaling a different skeleton.

- Punches and relaxed hands use the native palm frame. Closed fingers and the guarding fist no longer flare or flip during preparation.
- Sword and knife cuts retain torso drive, anticipation and recovery. Their wrists follow the forearms; the forehand has knuckles down and the returning backhand has knuckles up. Thrusts point forward. Crouched attacks use continuous joint arcs instead of a changing elbow bend plane. Paired sword contact checks include the complete return to guard. If the original contact offset would exceed native reach on that return, the fit releases it earlier; the authored cut and the reach, floor and walking-speed limits stay unchanged.
- Rifle and pistol holds fit the actual stock, grip, eye line and supporting hand. Finger bends use a stable native flexion plane, including the straight index outside the pistol guard. The pistol stock seats against the palm during a butt strike; the paired contact fit measures that same impact grip. Loading uses each weapon's physical length and bore. The ramrod hand and tool share a consistent frame. Native wrist checks accompany contact checks so a precise muzzle contact cannot conceal a bent wrist.
- Throws retain their original release markers. The throwing knife follows its release velocity; grenade and bolas preparations have continuous wrist paths and actual head clearance.
- Crouch/prone transitions use planted hands and knees. Crawling includes alternating leg assistance. The [unarmed prone support](../../../docs/art/prone-arm-support-3d-review-2026-10-07.md) is retained and fitted to the revised torso motion; the actual planted sleeve surface determines its pace, while equipped crawls retain their own pace. Recovery starts from the preceding resting pose. Work gestures have continuous arm arcs; prone working palms and fingers stay above the floor.
- The accepted [standing unarmed side steps](../../../docs/art/standing-unarmed-sideways-support-3d-review-2026-10-07.md) retain their exact published clips and pace. Their native boot support passes on the revised bodies. The [standing rifle side steps](../../../docs/art/standing-rifle-sideways-support-3d-review-2026-10-07.md) use the same native support and a reviewed chest-level carry. The support wrist stays below 36.6 degrees of bend and its palm stays within 2.35 mm of the rifle; the previous upright carry bent the wrist sharply. Fresh authoring passes complete-boot, travel-slip, wrist and grip checks.
- Riders fit the saddle and moving stirrups. Mounting follows a continuous leg and supporting-hand path. Falls clear the horse before reaching the existing ground posture. The saved gameplay position does not move during the animation.
- Roof climbing keeps continuous knee and elbow bend planes, a deeper intermediate foothold, and a lower forward mantle. The released hands return to idle before the final frame. Both native anatomies pass rung and roof contact checks, including runtime fits for 2–4.2 m ladders, diagonal approaches and vertical hatches. The saved endpoints, duration and action markers are retained.

The animation banks preserve native bone lengths and scales. They do not change hit damage, AP costs, ammunition, inventory ownership, or gameplay event markers. The two-cut lab combination remains exclusive to the old reference: one production strike has one contact marker.

The lab applies the production weapon offsets and quaternion rotations during playback. The game blends saddle placement with the active pose weights and uses the same animation clock for cloth. These details are required to show the exported contact corrections correctly.

## Evidence

The audit keeps immutable source snapshots, exported-library hashes, exact frame times and contact sheets. The [render review guide](../../../tools/characters-3d/RENDER-REVIEW.md) explains how to reproduce the exported-frame review. Local artifacts are under `artifacts/character-anatomy-review/`; they are intentionally not committed as large image bundles.

The original baseline records 672 movement frames across all eight appearances and 27 representative actions. The appearance pass adds 756 frames across six remaining presets and 41 representative actions. Focused checks cover the poncho, braid, coat tails, long garments, firearms, throws, mounted transitions, hands and task arcs. The final combined review adds 864 rendered images: 288 full-body frames and 576 close views of heads and hands, across all eight presets and 12 selected actions. The two complete native banks were also sampled at 120 Hz for joint-length, scale, loop-seam and abrupt-motion checks. That scan found and led to corrections for maintenance arm paths, climb knees, loading arms and recovery wrists. The maintenance review adds 66 rendered images and native arc tests for both anatomies.

The final motion candidate scan covers all 668 clips and 165,724 sampled poses.
The largest native joint-length error is below 0.000001 m and the largest scale
deviation is below 0.000003. All 53 native joint rest transforms per anatomy,
the source rig and body targets, and the shared motion constants are unchanged.
No monitored standing or crouched joint goes below the floor. This is a skeleton
check, not a proof that every skin or cloth triangle clears every surface.
The corrected climb has no terminal wrist reset; the earlier 39–42 cm knee jump
is about 1.9 cm at the same 120 Hz interval.

Of 226 loops, 202 close within numerical tolerance. The 24 standing side-step
loops retain an upstream end seam of up to 16.1 mm and 4.32 degrees. Lance poses
still need a separate wrist correction: standing carry reaches 82–108 degrees,
mounted carry reaches 164 degrees, and the bracing left wrist reaches 144 degrees.
These are recorded limits, not accepted anatomy. The scan and source checks are
kept in the local `scan-final-668` evidence bundle.

Face comparisons are under `artifacts/character-anatomy-review/face-reset/`.
The before views are recorded; candidate exports and final visual review are in
progress. Compare the face at the same projected size, as well as at the normal
isometric game scale. Pixel comparison off uses the native renderer; it does not
apply the pixel or contour pass.

## Validation status

The historical full-suite baseline was 5,457 passed, 26 failed and 5 skipped.
Those counts are baseline evidence, not a passing final gate. Corrections and
the new face exports are awaiting the final local gate; its result must replace
this pending status before delivery is described as validated.

Acceptance applies to the tested library and recorded views. It is not a claim
of historical reconstruction accuracy, universal cloth collision, or perfect
contact with every possible opponent and terrain shape. Additional faces, ages
and body builds remain separate variants, not properties of this two-anatomy bank.
