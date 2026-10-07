# Character library review — 2026-10-07

The user accepted Granadero preview `4921a38b` as a sufficient reference for
reuse and requested the other characters plus a merge to main. This accepts
the current direction; it does not establish final animation quality or
historical reconstruction accuracy.

## Appearance coverage

| Preset | Native anatomy | Retained identity |
| --- | --- | --- |
| granadero | Male | Navy uniform, red facings, crossbelt, detailed shako |
| royalist | Male | Light uniform, red facings and cockade, brass shako plate |
| worker | Male | Earth-colored shirt and waistcoat, bare head |
| surgeon | Male | Dark coat, linen cravat and fitted spectacles |
| gaucho | Male | Poncho, red scarf and felt hat |
| friar | Male | Habit, rope belt, folded hood and tonsure |
| woman-scout | Female | Green shirt, trousers and braid |
| woman-shawl | Female | Light shirt, burgundy shawl and skirt, hair bun |

All eight use the shared human surface treatment and three real mesh LODs.
Female proportions and bind poses remain native. Facial pigment remains
separate from the selectable skin color. Outfit and headwear replacement uses
the existing semantic parts. Civilian presets remove all military trim.

## Movement coverage

Each anatomy bank now has 334 semantic clips. The original 270-clip bank
includes 34 accepted reference clips through 29 distinct motions:

| Family | Semantic clips | Distinct reference motions |
| --- | ---: | ---: |
| Unarmed | 4 | 4 |
| Rifle and bayonet | 8 | 6 |
| Pistol | 6 | 5 |
| Sabre | 9 | 8 |
| Knife | 7 | 6 |
| Total | 34 | 29 |

Aim/idle/brace requests share suitable guard poses. The production binding
preserves contact and shot markers, body contribution, free-arm motion,
closed grips, and the accepted pace. It recomputes targets for each anatomy.
The manifest records the reviewed source name and source hash on each mapped
clip. The 30th preview motion, the two-cut sabre combination, is excluded:
one gameplay strike must have one contact.

Sabre strikes choose among descending cut, forehand, backhand, thrust and hilt
strike. Knife item 1813 uses knife guard, carry, cuts and thrust instead of sabre
poses. Variant choice is deterministic for a cue and stays fixed through its
phases. This changes presentation, not damage, AP cost or ammunition rules.

The remaining original families include crouched, prone and mounted movement,
interactions, reactions, transitions and specialized actions. Later increments
correct their exported movement pace and rifle loading contacts. This does not
establish visual acceptance of every original clip. The horse retains its source
and gait; gameplay now uses its measured exported stride.

Rifle loading and unloading now fit six actual weapon lengths, four postures
and both anatomy banks. The 48 additional clips are item-specific aliases.
The support hand follows the fore-end, the loading hand meets the muzzle, and
the ramrod follows the bore axis. Eight generic rifle loading clips receive the
same correction. The other 262 original clips and the bank meshes remain
byte-identical at this rifle increment. Geometry checks cover hand distance,
ramrod clearance, planted support feet and crouched stock clearance. Source
closeups and the normal interrupted-loading UI were reviewed; broad combat
motion acceptance remains open.

Pistol loading replaces four generic clips and adds sixteen item/bore aliases
per anatomy. Both working hands use the actual short barrel and timed rod.
Published contact checks cover all three pistols, four postures and the second
1808 bore. The maximum checked palm-to-muzzle gap is 0.69 mm and the rod centre
offset is 1.13 mm. Actual face and neck triangles clear a conservative 15 mm
barrel capsule in 45 native poses per hand, posture and charge: minimum surface
gaps are 34.50 mm male and 43.76 mm female. Source tool closeups and live four-bore
orders were inspected. The [pistol review](../../../docs/art/pistol-loading-3d-review-2026-10-07.md)
records the finite ammunition and input checks separately from these contacts.

Mounted boots now follow the actual moving stirrup irons. Checked sole contact
is within 7 mm during riding and within 6 mm at mount/dismount endpoints.
Native leg rotations supply the fit; anatomy, equipment contacts and saved
gameplay positions remain unchanged. Live riding and reverse mounting images
were reviewed. This does not establish paired mounted melee contact.

## Review and validation

The `/renderer-sandbox` **Ocho personajes** fixture displays all eight presets
without reading a saved campaign. The combat fixture includes the short knife.
The standalone Granadero preview remains the action-by-action reference.

The full builder writes local isometric appearance renders under
`authoring/.build/` when `--review` is supplied. The eight LOD0 appearance renders
were inspected for identity, native female proportions, misplaced military
trim and obvious clothing defects. Static poses cannot establish that cloth
remains clear of the body during every motion.

Additional native-source probes inspected the gaucho, friar and woman-shawl
in neutral, running and sabre-backhand contact poses. The poncho now follows
the trunk, clears the shoulders, and has narrow open side seams for the arms;
nearest-arm weights previously pulled it into sharp folds and opened its
collar. Long garments use calf-aware sewn panels and sparse crouch/prone
corrective shapes. The runtime blends those shapes with the body animation
clock. Live side views of the friar and woman-shawl confirm a low continuous
drape over the prone legs; the friar crawl also retains that silhouette.
The extreme backhand can still expose a small boot patch below the lead knee.
The underlying legs remain so replacing a habit with an owned shirt does not
leave missing geometry. These are skinned garments without general cloth
collision simulation. The correction preserves all six LOD triangle counts,
bones, textures and draw calls; their files add 150,468 bytes in total.

Export checks must verify hashes, native skeletons, weights, materials,
variable `COLOR_0` pigment, complete clip names and marker bounds. Runtime tests
must cover deterministic variants, knife item bindings, and simulation-owned
timing. Passing checks do not prove natural motion or sustained crowd speed.

Remaining visual limits include transition/braking steps, garment deformation
across the full posture bank, paired opponent contact, and broader individual
face/age/body variation. The isometric game view is the acceptance view.

The October 7 full-boot correction accepts the twelve native crouched idle/walk
clips in each anatomy within the [crouched support review](../../../docs/art/crouched-boot-support-3d-review-2026-10-07.md).
Worst stored penetration is below 0.3 mm; idle rests at 2 mm, and swinging feet
keep their recorded lift. All other clips and all upper/Root tracks remain exact.
Standing walking keeps the measured lower sole at 2 mm. Running has an 8–9 cm
flight phase. The twelve prone idle/crawl clips now keep the complete boot
between 1 and 3 mm above the floor; all other clips and body/arm/Root tracks
remain exact. The [prone support review](../../../docs/art/prone-boot-support-3d-review-2026-10-07.md)
records the retained weapon hold and measured surfaces. Exposed unarmed palms
and cuffs, sideways and lance support remain under review. These
published LOD0 surface measurements do not accept the remaining posture bank.
The complete native climb and roof-edge transfer are accepted within the [measured climbing review](../../../docs/art/native-climbing-3d-review-2026-10-07.md), including four clean playable same-cell hatch routes. The documented low-ceiling/headwear limit remains under review.
