# Full tactical-sector 3D integration

Status: implementation in progress in the isolated playground worktree. Models, terrain, camera, input and motion proceed in parallel with the other gameplay session. Ballistic effects wait for its tested ricochet merge. Integration base: `02eff792`, merged by `aa1f6aa3`.

This plan records the full requested scope. A character-only overlay, one working soldier, or an asset viewer is not completion.

## Delivery scope

- Replace the combat sector's sprite world with actual 3D geometry under a fixed orthographic camera. Retain pan, zoom, keyboard access, and the HTML portraits, inventory, statistics, and orders.
- Render all currently supported units, civilians, mounts, equipment, terrain, buildings, upper floors, doors, props, artillery, loot, lights, smoke, projectiles, and explosions.
- Preserve the approved human proportions and reference-based uniform. Add the existing appearance families and save-safe character variation.
- Preserve the simulation, saves, visibility, orders, AP, ammunition, health, randomness, and combat outcomes.
- Permit later art replacements without changes to those rules.

## Starting point

Read-only audit: main `90e5dfff`; prototype `47bc93fe`. These are audit references, not the eventual integration base.

The prototype contains a licensed MakeHuman adult body with native weights and 53 bones. Its nine clips cover standing idle, walk, run, rifle and pistol aim/fire, and sabre ready/strike. Its 115,640 triangles and 123 meshes are review assets, not a validated per-unit production budget.

The existing game has seven active appearance families, eight active variants, nineteen legacy appearance IDs, and 93 declared logical animation sequences. Newer throw, climb, and equipment actions extend that inventory. The declared sequence count alone is not a complete acceptance check.

## Boundaries

1. The ordinary reducer executes an order once. It controls all gameplay results.
2. Existing battle-presentation recording supplies paid movement steps, admitted events, and intermediate states. It must not change the final state or random stream.
3. A pure presentation adapter resolves visibility, actor identity, position, appearance, equipment, posture, readiness, and accepted action events.
4. The Three.js scene consumes those records. Its meshes, clip completion, collision geometry, and raycasts do not modify combat.
5. Semantic input proxies send the existing commands through the existing UI/controller path. Model anatomy does not define game hit chances or cover.

Do not give the character scene the complete hidden roster and conceal it with opacity. Hidden actors must not create meshes, shadows, picking targets, labels, animation tracks, or camera targets. Use `unit:<id>` and `npc:<id>` identities because their IDs can overlap.

## Replaceable asset contract

- Version the manifest independently of save data.
- Use metres, one declared forward axis, a stable ground origin, and explicit height/bounds.
- Map semantic rig roles to native bones. Game code must not refer to `hand_r` or `RifleFire`.
- Declare material roles for skin, hair, cloth, leather, trim, and metal. A later material-name change must require only a manifest update.
- Declare right/left grip, support grip, muzzle, scabbard, stowed item, saddle, and rider sockets.
- Declare supported semantic actions, legal postures, clip/layer mapping, duration, stride speed, and visual event markers.
- Animation markers may trigger visual effects. The recorded authoritative event remains the source of damage, ammunition use, and action completion.
- Match playback to paid visual distance. Clip root motion must not move the simulation.
- Validate missing capabilities explicitly. Do not quietly substitute idle for an unsupported action.
- Share geometry, textures, and palette materials. Clone only per-actor skeleton and playback state.
- Preserve stable appearance choices across load/save and asset updates. Never consume gameplay randomness for cosmetic variation.

## Character coverage

Existing families: military (granadero and royalist), worker, civilian man, poncho wearer, friar, woman combatant, and civilian woman. Preserve explicit authored appearance IDs and existing skin resolution. Enemy faction uniform remains authoritative.

Use native source anatomy for body variation and the female body. Do not stretch the approved body on one axis or attach mismatched limbs. Keep head, hand, shoulder, and leg proportions human at tactical scale.

Clothing and physical hands come from current equipment state. Support worn headwear/outfits/legwear; two hands; paired pistols; stowed and dropped weapons; fitted bayonets; tools and held supplies. Preserve the HTML portraits.

Weapon silhouettes include Brown Bess, Charleville, Baker, cavalry carbine, shotgun, blunderbuss, three pistol types, two sabres, socket bayonet, lance, and facón. Use the actual compatibility rules for fittings.

Build merged, material-batched real-mesh LODs. Initial targets for investigation are 12–18k, 5–8k, and 2–3k triangles. These are proposed budgets, not measured acceptance. Preserve the human silhouette before removing detail.

## State and action coverage

Keep separate life, posture, mobility, locomotion, readiness, and transient action dimensions.

- Alive, unconscious, and dead. Death takes priority over every pending action. A loaded corpse is already settled. A witnessed death may collapse once. Unconscious breathing is not a death loop.
- Standing, crouched, prone, and all six posture transitions. Distinguish voluntary prone from knockdown and recovery.
- Walk, run, crouch walk, armed/unarmed crawl, mounted idle/walk/run, climb, mount, dismount, and forced dismount.
- Aim, fire, reload/partial reload, reprime, repair, unload, paired/offhand discharge, brace, bayonet/butt/lance strike, sabre/facón cut, punch, charge.
- Knife, grenade, torch, and bolas throws; self/other healing; loot/equip/drop/transfer/steal; doors/containers/environment; breach; free; ration; gift.
- Artillery fire/load/move/pivot and the assigned crew. Preserve partial crew work and authoritative crew movement.

Use explicit action instance IDs. AP/ammunition changes are not a reliable action restart clock. Honour `performed`, `shotComplete`, `contactComplete`, and `discharge` so preparation or penetrating continuation does not create a second attack.

Preserve climb kind/link metadata and `tacticalLevel` independently of rank. Newly visible actors start at the observed position; never animate their hidden approach. Preserve-facing moves retain facing. Keep gait phase continuous across paid steps.

## World and camera

The new world uses authored grid cells and metric elevations. Meshes do not become simulation obstacles.

Ground compatibility can preserve the current projection `screenX = originX + 26(x-y)`, `screenY = 65 + 14(x+y)` with a fixed orthographic camera. Let `pitch = asin(14/26)` and choose world units per cell from the existing vertical pixels per metre. A shared projection helper must drive scene placement, overlays, hit proxies, minimap focus, and camera anchoring.

The old `surfaceRenderOffset` compensates for SVG building artwork. Do not copy it unchanged into the metric world. Roofs, platforms, actors, projectiles, and controls must use the same actual elevation. Test this before changing gameplay overlays.

For exact ground/elevation alignment, let `V` be the chosen vertical pixels per metre, `P = V / cos(pitch)` be camera pixels per world metre, and `T = 26 * sqrt(2) / P` be metres per grid cell. Map `(x,y,height)` to Three.js `(x*T,height,y*T)`. The fixed camera looks from positive X/Z with azimuth 45 degrees. Its frustum can be shifted by the existing camera's pixel offsets, converted through `P`. Unit tests must prove ground corners, elevated points, viewport resize, and zoom anchors against the shared projection.

A read-only Three.js calculation verified 180 projected points across three viewport sizes, four zoom values, three camera offsets, and ground/elevated positions. Maximum error was below `5e-12` pixels. With the currently audited vertical scale, pitch is `32.57897039280412` degrees, `P = 29.74742067872502`, and `T = 1.2360585147470482`. This verifies the projection equation only; it is not an integrated camera/input test.

Build terrain in cached chunks or instanced batches. Build walls on structural cells, with real openings, current door state, damage and breaches. Preserve architectural profiles, roof cutaways, discovered rooms, upper surfaces, climbing links, props, and interior disclosure. Terrain textures may remain textures on real geometry; scenery and actors must not become sprite billboards.

Dynamic contents require visibility admission on their own level. A remembered building silhouette does not reveal its occupants, loot, lights, or controls. Foliage fading must depend only on admitted actors.

The proposed world module is `createSectorWorld(scene, {tileMetres, assetUrl})`, with `update(input)`, `dispose()`, and `inspect()` methods. Its input contains terrain, revealed rooms, cursor level, admitted actor points, and filtered props/lights/loot/cannons/smoke. It receives no full unit or civilian roster. Expose stable cannon muzzle anchors for the recorded effects layer.

Build current walls from `state.tiles`: a breach changes a structural cell to rubble while `building.walls` can still contain its original record. Use upper-surface slab thickness and actual elevation. Update and dispose changed chunks/structures without rebuilding the whole sector for a countdown tick.

Ground loot requires the admitted source item identity and visual kind as well as the existing pile counts. Preserve that distinction in the adapter so the world can show actual equipment. Use the existing terrain/profile/appearance helpers to retain regional geography, architecture, material choice, prop footprints, rotation and damage state.

Retain semantic SVG/HTML interaction and annotations where useful. They must not draw a second sprite world under or over the 3D scene. Keyboard selection, body-part targeting, civilian treatment, loot, and inventory cursor behavior must remain available.

## Effects

Consume the recorder's already admitted firearm segment, knife path, grenade arc and landing. Do not compute a second ballistic path or mesh-based hit.

Respect `discharge:false` for penetration continuation. Do not expose hidden interception points or invent visible pellet paths. Use the recorded outcome/material only for the visual impact.

Artillery needs presentation-only trace events from its existing resolved `artilleryShotTrace`. Never execute a second shot to make an effect. Confirm this gap against the refreshed main before editing.

Support reduced motion, pause/background behavior, renderer disposal, context loss, and asset-load failure. Show a clear failure state rather than silently replacing unsupported actors with the granadero.

## Implementation order

1. Verify the other session is finished and merged. Fetch and safely update main. Preserve unrelated files and the prototype worktree.
2. Create the integration worktree from the verified latest main. Record that commit. Import only the approved prototype sources and assets needed by this feature.
3. Add the pure actor/world presentation contract and coordinate adapter, including visibility and input proxies.
4. In parallel, build production human variants/equipment/LODs and the complete semantic motion library.
5. Replace terrain/buildings/props/artillery and integrate the cached Three.js scene behind the retained HTML interface.
6. Add recorded effects, upper floors, mounts, life states, transitions and all interaction states. Remove combat-sector sprite rendering only when equivalent coverage is present.
7. Run contract/replay/input checks and visually inspect the actual game, not only the sandbox.
8. Run the full local gate, record measured performance and any unresolved limits, and deliver the full feature for review.

## Acceptance evidence

- Replay parity: identical final state, random seed, AP, ammunition, health, time, terrain changes and saved data with rendering enabled or disabled.
- Capability coverage: every supported current order/state maps to an explicit visual sequence, including interrupted and rejected preparation.
- Model replacement: swap a model and its manifest without changing gameplay code. Replay results and semantic input targets remain identical.
- Visibility: hidden actors create no world nodes, shadows, labels, targets or retained movement. Include overlapping NPC/unit IDs.
- Input: unchanged movement, preserve-facing, grouped movement, body-part aim, equipment cursor, NPC treatment, loot, keyboard selection and pan/pinch anchors.
- Elevation: actors and effects align on roofs/platforms; shared sight and selected cursor-level interaction remain distinct; climb and destruction transitions stay aligned.
- Animation: standing/crouched/prone/mounted, life priority, repeated exploration actions, paired fire, partial reload, forced dismount, interrupts and counterattacks.
- Art: compare people at roughly 60, 90 and 140 screen pixels, in all eight directions, with each skin choice and outfit family. Inspect foot contact, shoulders, hands, weapon grips and cloth fit.
- Full scene: terrain, architecture, roof cutaway, props, doors, loot, artillery, smoke, light and projectile effects are actual working 3D content.
- Performance: measure 24, 60 and 100 admitted actors with scenery/shadows/effects on the available machine. Report frame timings and draw calls; do not infer them from the one-character demo.
- Local verification: focused new tests, existing reducer/playback suites, complete test runner, shard checks, documentation/baseline audits, typecheck, production build and diff checks. Green tests alone do not certify visual quality.
- Browser handover: open the actual integrated game, exercise the controls and leave it available. Preserve the existing game origin when relevant to saves.

## Preparation findings to verify on refreshed main

- `useUnitMotion` currently keys units and civilians by bare IDs and loses climb/link metadata in samples.
- `SpriteFigure` restarts actions using AP/loaded state; use explicit accepted-action IDs in the new renderer.
- The coarse `spriteOrderPose` omits distinctions required by the full action contract.
- The current hero asset must be reduced and batched before use across a full sector.
- Artillery has resolved traces but lacks firearm-equivalent recorded visual stages.

## Asset candidates for later inspection

The [MakeHuman system asset pack](https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html) lists CC0 female proxies, skin, and hair. These may support the missing native female anatomy and appearance modules. Its [core asset FAQ](https://static.makehumancommunity.org/makehuman/faq/are_makehuman_files_free.html) confirms CC0 for core mesh/target assets.

The [Lyndon Daniels horse rig submitted by ChadM](https://opengameart.org/content/rigged-horse) is listed as CC0 and provides a Blender file. The source page describes a rigged mesh, not a completed animation bank. Inspect anatomy, weights, scale, textures and provenance before use; the page also reports missing weights on some separate details. This is a candidate, not an approved or downloaded asset.

Additional CMU motion candidates, verified by catalogue description and file presence only:

| Need | First candidate | Inspection required |
| --- | --- | --- |
| Crouch walk | [136_09](https://mocap.cs.cmu.edu/search.php?subjectnumber=136) | Session includes unusual gait styles. Check crouch depth and balance. |
| Crawl | [111_03](https://mocap.cs.cmu.edu/search.php?subjectnumber=111) | Pregnancy-motion session; may not be a belly crawl. |
| Ladder | [143_37](https://mocap.cs.cmu.edu/search.php?subjectnumber=143) | Fit hand and foot contacts to the actual access geometry. |
| Ground recovery | [140_01](https://mocap.cs.cmu.edu/search.php?subjectnumber=140) | Preserve natural recovery; do not reverse it to claim a natural fall. |
| Collapse | [90_16](https://mocap.cs.cmu.edu/search.php?subjectnumber=90) | Staged fall; check suitability and body contacts. |
| Pickup | [143_10](https://mocap.cs.cmu.edu/search.php?subjectnumber=143) | Toolbox weight transfer requires different grips for small objects. |

These BVHs are listed in the existing conversion mirror at commit `09a07f54f3bbb58797325f009282d0b2048a2871`, under `data/<three-digit subject>/<clip>.bvh`. They have not been downloaded or visually approved. [Conversion provenance](https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/09a07f54f3bbb58797325f009282d0b2048a2871/READMEFIRST.txt).

CMU's [source terms and capture notes](https://mocap.cs.cmu.edu/) permit use in commercial products but prohibit resale of the motion data itself. Do not label these motions CC0. Finger/thumb motion was not recorded. No period musket reload was found in the conversion index: cartridge, ramrod, priming, partial reload, and fine grips need native authoring.

This file is a plan. It does not certify that any integration item has been implemented or tested.
