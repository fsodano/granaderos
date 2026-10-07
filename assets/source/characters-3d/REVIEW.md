# Character library review — 2026-10-06

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

Each anatomy bank has 270 semantic clips. The accepted reference supplies
34 of those clips through 29 distinct motions:

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

The other 236 semantic clips per anatomy keep existing production authoring.
They include crouched, prone and mounted movement, reloads, interactions,
reactions, transitions and specialized actions. They were not all revised or
visually approved in this pass. The horse retains its existing source and gait.

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
collar. Long garments use continuous weights across both thighs and extra
knee clearance so running reads as one drape. The extreme backhand can still
expose a small boot patch below the lead knee. The underlying legs remain so
replacing a habit with an owned shirt does not leave missing geometry. These
are skinned garments, not a cloth simulation with general collision handling.

Export checks must verify hashes, native skeletons, weights, materials,
variable `COLOR_0` pigment, complete clip names and marker bounds. Runtime tests
must cover deterministic variants, knife item bindings, and simulation-owned
timing. Passing checks do not prove natural motion or sustained crowd speed.

Remaining visual limits include transition/braking steps, garment deformation
across the full posture bank, paired opponent contact, and broader individual
face/age/body variation. The isometric game view is the acceptance view.
