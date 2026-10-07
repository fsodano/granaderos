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

The pass corrects washed-out skin maps, open hairlines, collar seams, sleeve cuffs and cloth detail. Faces retain the licensed native human surface and UVs. Skin color is separate from clothing and facial pigment. The female models retain their native proportions and bind poses. Clothing replacement still uses the existing semantic parts.

Poncho openings allow the arms to pass beside the torso. Long garments have separate crouched, face-down and face-up shapes. Coat tails flatten under a fallen body rather than lifting the body above the floor. These are authored cloth corrections, not a cloth simulation.

## Motion and contact

- Punches and relaxed hands use the native palm frame. Closed fingers and the guarding fist no longer flare or flip during preparation.
- Sword and knife cuts retain torso drive, anticipation and recovery. Their wrists follow the forearms; the forehand has knuckles down and the returning backhand has knuckles up. Thrusts point forward. Crouched attacks use continuous joint arcs instead of a changing elbow bend plane.
- Rifle and pistol holds fit the actual stock, grip, eye line and supporting hand. Loading uses each weapon's physical length and bore. The ramrod hand and tool share a consistent frame. Native wrist checks accompany contact checks so a precise muzzle contact cannot conceal a bent wrist.
- Throws retain their original release markers. The throwing knife follows its release velocity; grenade and bolas preparations have continuous wrist paths and actual head clearance.
- Crouch/prone transitions use planted hands and knees. Crawling includes alternating leg assistance. Recovery starts from the preceding resting pose. Work gestures have continuous arm arcs; prone working palms and fingers stay above the floor.
- Riders fit the saddle and moving stirrups. Mounting follows a continuous leg and supporting-hand path. Falls clear the horse before reaching the existing ground posture. The saved gameplay position does not move during the animation.

The animation banks preserve native bone lengths and scales. They do not change hit damage, AP costs, ammunition, inventory ownership, or gameplay event markers. The two-cut lab combination remains exclusive to the old reference: one production strike has one contact marker.

The lab applies the production weapon offsets and quaternion rotations during playback. The game blends saddle placement with the active pose weights and uses the same animation clock for cloth. These details are required to show the exported contact corrections correctly.

## Evidence

The audit keeps immutable source snapshots, exported-library hashes, exact frame times and contact sheets. The [render review guide](../../../tools/characters-3d/RENDER-REVIEW.md) explains how to reproduce the exported-frame review. Local artifacts are under `artifacts/character-anatomy-review/`; they are intentionally not committed as large image bundles.

The original baseline records 672 movement frames across all eight appearances and 27 representative actions. The appearance pass adds 756 frames across six remaining presets and 41 representative actions. Focused checks cover the poncho, braid, coat tails, long garments, firearms, throws, mounted transitions, hands and task arcs. The final combined review adds 864 rendered images: 288 full-body frames and 576 close views of heads and hands, across all eight presets and 12 selected actions. The two complete native banks were also sampled at 120 Hz for joint-length, scale, loop-seam and abrupt-motion checks. That scan found and led to corrections for maintenance arm paths, climb knees, loading arms and recovery wrists. The maintenance review adds 66 rendered images and native arc tests for both anatomies.

Acceptance applies to the tested library and recorded views. It is not a claim of historical reconstruction accuracy, universal cloth collision, or perfect contact with every possible opponent and terrain shape. Broader face, age and body variation remains a separate art task.
