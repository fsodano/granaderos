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

The earlier pass corrects open hairlines, collar seams, sleeve cuffs and cloth detail. The user requested a further face pass because the Granadero still looked like a toy. The new source uses clean CC0 young male and female skin maps from the MakeHuman system pack, at 2048 pixels. It retains local color variation, adds spatial roughness, and derives restrained normals from fine source grain. Aksel is no longer used by the current appearance source. Faces retain the native human surface and UVs; selectable skin color, female proportions, bind poses and clothing parts remain intact. The exported face review now shows local lip and cheek color, curved irises and pupils, and fitted individual brow hairs. Color, normal and roughness maps remain connected to the native head UVs in all 24 appearance LODs; reduced geometry and small screen size still limit visible detail. Cloth weave, buff leather, polished visors and brass have distinct surface responses. Light cloth has restrained relief, and civilian hair has directional strands and a fitted hairline. The final exported Granadero and scout faces, and all eight appearances in the live lab, were visually checked. This is the agent's recorded review; final user acceptance of the new appearance has not been given.

Poncho openings allow the arms to pass beside the torso. Long garments have separate crouched, face-down and face-up shapes. Coat tails flatten under a fallen body rather than lifting the body above the floor. Military crossbelts share seam vertices and native skin weights with each reduced coat, so the shoulder strap follows the actual cloth at all three detail levels. These are authored cloth corrections, not a cloth simulation.

The further military cloth pass adds curved elbow compression folds, short
waist gathers, a 2.6 mm collar return and thicker cuff edges to the Granadero
and Realista. It changes only their outfit surfaces across six body files.
Native bindings, skin, hands, trousers, boots and headwear accessors remain
byte-identical. The Granadero LOD0 rises from 54,130 to 59,996 triangles;
lower detail levels remain at the existing reduction settings. All 15 coat
and crossbelt contact checks pass. Matched isometric renders show a modest
improvement, clearest at the elbows and waist. This does not establish the
full detail level of the user's reference.

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
- The later crouched-punch and low-work correction covers 13 clips per anatomy.
  Actual forearm-to-palm bend stays below 7.13 degrees, hand speed below
  2.36 m/s and hand skin at least 7.10 mm above the floor at 120 Hz. Only 90
  arm/fist rotation channels per anatomy change. Deep pickup lets the free arm
  counterbalance beside the leg instead of compressing the elbow against the knee.
- Priming, repairs and pistol unloading use a relaxed inspection hold. Across
  20 clips per anatomy, actual wrist bend stays below 16.82 degrees, local arm
  speed below 511 degrees/s and hand speed below 3.76 m/s at 120 Hz. The prone
  hands clear the floor by at least 196 mm. A steady middle reach and authored
  surface clearance avoid both the prior folded wrist and a ground-crossing
  palm arc. Body/leg channels, durations and event metadata remain unchanged.
- Sword and knife cuts retain torso drive, anticipation and recovery. Their wrists follow the forearms; the forehand has knuckles down and the returning backhand has knuckles up. Thrusts point forward. Crouched attacks use continuous joint arcs instead of a changing elbow bend plane. Paired sword contact checks include the complete return to guard. If the original contact offset would exceed native reach on that return, the fit releases it earlier; the authored cut and the reach, floor and walking-speed limits stay unchanged.
- Rifle and pistol holds fit the actual stock, grip, eye line and supporting hand. Finger bends use a stable native flexion plane, including the straight index outside the pistol guard. The pistol stock seats against the palm during a butt strike; the paired contact fit measures that same impact grip. Loading uses each weapon's physical length and bore. The ramrod hand and tool share a consistent frame. Native wrist checks accompany contact checks so a precise muzzle contact cannot conceal a bent wrist.
- Throws retain their original release markers. The throwing knife follows its release velocity; grenade and bolas preparations have continuous wrist paths and actual head clearance.
- Crouch/prone transitions use planted hands and knees. Crawling includes alternating leg assistance. The [unarmed prone support](../../../docs/art/prone-arm-support-3d-review-2026-10-07.md) is retained and fitted to the revised torso motion; the actual planted sleeve surface determines its pace, while equipped crawls retain their own pace. Recovery starts from the preceding resting pose. Work gestures have continuous arm arcs; prone working palms and fingers stay above the floor.
- The accepted [standing unarmed side steps](../../../docs/art/standing-unarmed-sideways-support-3d-review-2026-10-07.md) retain their exact published clips and pace. Their native boot support passes on the revised bodies. The [standing rifle side steps](../../../docs/art/standing-rifle-sideways-support-3d-review-2026-10-07.md) use the same native support and a reviewed chest-level carry. The support wrist stays below 36.6 degrees of bend and its palm stays within 2.35 mm of the rifle; the previous upright carry bent the wrist sharply. Fresh authoring passes complete-boot, travel-slip, wrist and grip checks.
- Riders fit the saddle and moving stirrups. Mounting follows a continuous leg and supporting-hand path. Falls clear the horse before reaching the existing ground posture. The saved gameplay position does not move during the animation.
- Lance carry and brace use bounded native wrist and finger frames. This grip correction covers 17 existing non-thrust clips per anatomy; it preserves thrust attacks, torso and leg motion, durations and markers. The separate incoming [standing lance idle support](../../../docs/art/standing-lance-idle-support-3d-review-2026-10-07.md) changes only the six thigh/calf/foot rotation tracks in `stand.idle.lance` per anatomy. Its source integration preserves the revised upper-body grip, Root, pelvis, ball tracks and timing. The runtime blends the lance frame through carry/brace transitions instead of switching it at the first tick.
- Roof climbing keeps continuous knee and elbow bend planes, a deeper intermediate foothold, and a lower forward mantle. The released hands return to idle before the final frame. Both native anatomies pass rung and roof contact checks, including runtime fits for 2–4.2 m ladders, diagonal approaches and vertical hatches. The saved endpoints, duration and action markers are retained.

The animation banks preserve native bone lengths and scales. They do not change hit damage, AP costs, ammunition, inventory ownership, or gameplay event markers. The two-cut lab combination remains exclusive to the old reference: one production strike has one contact marker.

The lab applies the production weapon offsets and quaternion rotations during playback. The game blends saddle placement with the active pose weights and uses the same animation clock for cloth. These details are required to show the exported contact corrections correctly.

## Evidence

The audit keeps immutable source snapshots, exported-library hashes, exact frame times and contact sheets. The [render review guide](../../../tools/characters-3d/RENDER-REVIEW.md) explains how to reproduce the exported-frame review. Local artifacts are under `artifacts/character-anatomy-review/`; they are intentionally not committed as large image bundles.

The original baseline records 672 movement frames across all eight appearances and 27 representative actions. The appearance pass adds 756 frames across six remaining presets and 41 representative actions. Focused checks cover the poncho, braid, coat tails, long garments, firearms, throws, mounted transitions, hands and task arcs. The final combined review adds 864 rendered images: 288 full-body frames and 576 close views of heads and hands, across all eight presets and 12 selected actions. The two complete native banks were also sampled at 120 Hz for joint-length, scale, loop-seam and abrupt-motion checks. That scan found and led to corrections for maintenance arm paths, climb knees, loading arms and recovery wrists. The maintenance review adds 66 rendered images and native arc tests for both anatomies.

The preceding delivery scan, recorded in `scan-delivery-668` after the guard,
lance grip and incoming standing lance idle support integrations, covers all
668 clips and 165,724 sampled poses at 120 Hz. It predates the further
military cloth and wrist corrections described below.
Its manifest hash is
`72774dd03356ff62f6bd5a9e6700929a310e2fa04e62d55f5dea39564d742a74`.
The recorded manifest, both body files and both animation banks match the
canonical candidate and the published library byte for byte.
The largest native joint-length error is below 0.000001 m and the largest scale
deviation is below 0.000003. All 53 native joint rest transforms per anatomy,
the source rig and body targets, and the shared motion constants are unchanged.
No monitored joint in a non-lifecycle standing or crouched clip goes below the
floor. This is a skeleton check, not a proof that every skin or cloth triangle
clears every surface.
The corrected climb has no terminal wrist reset; the earlier 39–42 cm knee jump
is about 1.9 cm at the same 120 Hz interval.

In the final scan, 202 of 226 loops close within 0.000001 m and 0.056 degrees.
The 24 standing side-step loops retain an upstream end seam of up to 16.1 mm
and 4.32 degrees. This measured seam remains a limit; it is not removed by
the final lance grip correction.

The lance correction replaces the excessive wrist bends found by the prior
`scan-final-668` review. Across 34 non-thrust clips sampled at 120 Hz, the
measured maximum wrist bend is 28.82 degrees. In both anatomies and all three
brace postures, the ten
finger groups reach the actual shaft within 1.18 mm, with no sampled skin
penetration. Six exported grip tests and eight rider checks pass. The runtime
carry/brace check removes the previous 55-degree initial item jump; the maximum
sampled palm gap is 0.793 mm (rounded), below its 1 mm gate. This transition
metric uses the nearest actual skinned hand surface, while the separate static
grip check measures the fingers. Local evidence is recorded in
`/tmp/granadero-lance-wrist/ACCEPTANCE.md` and
`/tmp/granadero-lance-transition/acceptance.json`. The reviewed images include
standing, crouched and mounted braces plus 24 carry/gait frames. These checks
accept the measured carry/brace correction, not every possible lance contact.

Face comparisons are under `artifacts/character-anatomy-review/face-reset/`.
The final face, head, hand and body views are in its `delivery/` directory,
alongside live screenshots of all eight characters. Compare the face at the
same projected size, as well as at the normal isometric game scale. The 24
facial surface checks sample the actual native head UVs and verify that color,
normal and roughness detail survives export. All 26 body/garment skeleton
signatures retain the exact native joints, hierarchy and inverse-bind matrices. Pixel comparison off uses the native renderer; it does not
apply the pixel or contour pass.

## Face structure and grip follow-up

The further face pass adds small cheek, brow, nose and mouth planes to both
native anatomies. Maximum measured movement is 1.23 mm; the source UVs and
weights stay exact. The head now retains 80%, 45% and 16% of its source
geometry across the three detail levels. The previous whole-skin reduction
used 22%, 7.5% and 2.8%, which removed useful eyelid and lip structure. A fitted
brow base and irregular fine hairs also replace the sparse dotted brows.

All 24 rebuilt body files preserve the native skeleton and every non-head
triangle's position, normal, UV, pigment and named bone-weight mapping. Equal
weights may have a different joint-slot order; their deformation is identical.
The Granadero LOD0 now has 87,375 triangles and six draw calls. The combined
surface, collar and crossbelt gates pass all 39 tests. Actual exported idle
renders cover all eight appearances; additional Granadero and scout views
cover both reduced detail levels. These are offline model renders. This pass
does not establish the clothing, hair or individual character variation of
the user's reference. The source still has two shared native faces.

The pistol strike shortens two right-hand reach targets while retaining its
body motion, contact marker, duration and weapon orientation. Only three arm
rotation tracks per anatomy change. Dense native wrist checks now remain
below 52.18 degrees, and all 17 retained pistol/sabre runtime checks pass on
the reviewed candidate. Mounted rifle idle, walk and run also use a lower,
diagonal carry; their six arm tracks per clip keep both hands on the stock,
with measured wrist bend below 30.15 degrees. Neither increment replaces
unrelated motion tracks. Detailed hash and preservation receipts are in the
local delivery artifacts.

## Validation status

The next integration remains in review. The incoming rifle contact gate
currently passes 21 of 27 tests; six failures expose native rifle grip and
paired-contact compatibility problems. These are not baseline failures and
must pass before this branch is merged. A separate actual forearm-to-palm
audit also found static wrist folds that the older angular-continuity checks
did not detect. Maintenance, low work and crouched-punch repairs are now
published and pass their combined 10 wrist, arc and floor gates, plus two
retained low-work boot checks. Rifle unload and rifle strikes remain
in private review. Their pending files are not accepted
merely because a wrist is straight; speed, surface clearance and item contact
also need to pass. PR #239 remains a draft while this review is active.

The broad local quick gate completed all 809 selected files: **5,642 passed,
4 failed, 0 skipped**. The four failures match the current-main baseline
exactly: artillery mount cue (0 vs 1), climb segment (0.01299638895332932 vs
0.5), roof inset (245.379320490434 vs 254.5), and projected height (1.2765625
vs 1.5). The separate 47-file character/contact gate passed **398 of 399**
tests; its only failure is that same baseline climb timing assertion. Neither
result is described as an entirely green suite. The older full run (5,457
passed, 26 failed, 5 skipped) remains historical evidence; its generated-asset
failures were corrected before these final gates.

The combined focused gate after the guard and lance grip corrections passed
all 114 tests, before the final standing lance idle support integration. The
subsequent lance integration gate passed all 10 grip, complete-boot support
and runtime transition tests. These are separate affected-area checks, not a
replacement for the broad results and baseline failures above.

Typecheck, production build and published-library verification pass. The live
lab loads all eight characters and the three skin palettes. Pistol, rifle,
sword and knife actions, and a paired sword attack in the game scene, were
checked without new browser errors. Guard integration adds 12 support/blend
checks on the final bodies, with all unrelated motion channels preserved.

Agent review applies to the tested library and recorded views. It is not user
approval of the revised appearance, or a claim
of historical reconstruction accuracy, universal cloth collision, or perfect
contact with every possible opponent and terrain shape. Additional faces, ages
and body builds remain separate variants, not properties of this two-anatomy bank.
