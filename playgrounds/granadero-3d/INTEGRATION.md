# Integrated tactical-sector 3D renderer

Status: the renderer is integrated in the isolated worktree and under review in [draft PR #156](https://github.com/fsodano/granaderos/pull/156). Ballistics from `origin/main` at `46ce4578` are merged. Renderer checks and the production build pass. The complete test suite has seven failing campaign files, all reproduced with identical assertions on clean `main`. The PR remains a draft; it has not been merged or deployed.

The combat sector uses Three.js geometry under a fixed isometric orthographic camera. Pan, zoom and keyboard controls remain. Portraits, inventory, statistics and orders remain in HTML. SVG supplies semantic input targets and annotations; it does not draw a second sprite world. The original one-character playground remains separate from the production library.

## Gameplay and visibility boundaries

1. The ordinary reducer executes each order once and owns coordinates, body heights, collision, AP, ammunition, health, time, randomness and saved state.
2. Battle presentation records the paid movement steps, intermediate states and disclosed combat events. Rendering consumes these records without resolving another attack.
3. The presentation adapter admits actors and dynamic contents through sight and interior visibility. The scene receives no complete hidden roster. Unit and civilian identities use separate `unit:<id>` and `npc:<id>` namespaces.
4. Hidden actors create no character meshes, shadows, labels or input targets. A newly observed actor starts at its observed position; hidden travel is not replayed. Visual foliage and wall cutaways must use only admitted actor positions.
5. The existing controls submit the existing game orders. Mesh anatomy, raycasts, clip markers and animation completion cannot change combat results.

The shared projection retains `screenX = originX + 26(x-y)` and `screenY = 65 + 14(x+y)`. Grid cells map to `(x*T, height, y*T)`, where `T` is approximately 1.23606 metres. Camera pitch is approximately 32.579 degrees. Actors, terrain, upper surfaces, effects and input proxies use the same metric elevation. The old SVG facade inset is not applied to this projection.

## Replaceable character library

The production manifest is `web/public/models/characters/manifest.json`; reproducible authoring is in `assets/source/characters-3d/`. See its [source and build documentation](../../assets/source/characters-3d/README.md).

There are eight appearance families: granadero, royalist, worker, surgeon, gaucho, friar, woman-scout and woman-shawl. They use two native MakeHuman anatomies, each with 53 bones, uniform body normalization and its own shared bank of **244 clips**. Skin palettes remain light, brown and dark. Clothing, hands and carried items follow current equipment ownership. The separate horse keeps its 19-bone rig.

The versioned manifest declares axes and units, appearance IDs, rig roles, skin material roles, LODs, clothing replacement rules, hand/stowed/muzzle/saddle sockets, semantic clip bindings, duration, stride speed and event markers. It also declares native bone mirroring and the left-pistol socket frame. An item can override a visual clip without changing its rules class; the lance uses carry, brace and thrust poses through this mechanism.

Models can be replaced through these bindings without changing gameplay. Missing capabilities fail explicitly. Geometry, textures and immutable clips are shared; each actor has independent bones and playback state. Cosmetic variation does not consume simulation randomness.

## Action and world coverage

The integrated action contract covers:

- Standing, crouched and prone postures; six transitions; death, unconsciousness, knockdown and recovery.
- Walk, run, crouched walk, crawl, standing/crouched side steps, backward movement, climbing, mounted movement, mounting and dismounting.
- Aim, fire, paired/offhand pistols, reload and partial reload, reprime, repair, unload, brace, bayonet, butt, lance, sabre, facón, punch and charge.
- Knife, grenade, torch and bolas throws; healing, equipment and loot transfers, doors, containers, tools, breach, freeing, rations and gifts.
- Artillery fire, loading, movement and pivoting, with the existing crew requirements and paid work.

Recorded human gait is retargeted to native anatomy. Period weapon handling and contacts are authored. Playback follows paid visual distance and declared stride speed; climbing follows the recorded segment fraction. Action IDs and recorded phases control attack restarts. Mounted falls remove the saddle offset by their ground-contact marker. Animation never moves the simulation root.

The world contains terrain, buildings, doors, breaches, roof slabs and access links, props, carried/dropped equipment, loot, artillery, lights and smoke. Current wall state comes from tactical tiles. Scene resources are cached and disposed when replaced; context loss and asset errors have a visible recovery control.

Firearm, knife, grenade and artillery effects use admitted recorder paths and outcomes. Penetration/ricochet continuation respects discharge suppression. No second ballistic trace or invented pellet hit determines the result. Artillery's **0.65 m ground-relative display height is a visual convention**: its existing rules trace uses grid coordinates. It does not add a new ballistic height rule.

## Current asset sizes and budgets

These values come from the current manifest. Triangle counts cover the appearance body and base attire; held equipment, replacement garments, horses, shadows and scenery add work.

| Human LOD | Triangles across eight families | Material/mesh draw calls | GLB bytes per appearance |
| --- | ---: | ---: | ---: |
| 0 | 25,366–30,856 | 5–6 | 969,440–1,198,376 |
| 1 | 10,722–17,050 | 5–6 | 457,796–713,544 |
| 2 | 4,239–8,099 | 5–6 | 218,524–369,440 |

The earlier investigation targets of 12–18k, 5–8k and 2–3k triangles are **not met**. The current meshes preserve the human silhouette; further optimization needs visual review and measured scene cost.

The male animation GLB is 7,495,956 bytes; the female bank is 7,442,340 bytes. The shared equipment GLB has 26 entries and is 611,508 bytes. Horse LODs contain 17,322 / 10,577 / 6,081 triangles. All production GLBs total 32,535,628 bytes, excluding shared external textures and the manifest. This total is not the download cost of every scene: assets load by appearance and LOD.

Native body/target assets and the horse are CC0. CMU motion uses its own terms, which permit use in commercial products but prohibit resale of raw motion data. Source URLs, hashes, original terms and adaptations are retained with the authoring sources.

## Validation and handover

The live test route is `http://localhost:3148/renderer-sandbox`. It offers **Combate**, **Montura y azotea**, **Noche**, 24/60/100-character scenes and the real Tucumán map. These scenes use valid battle snapshots, finite equipment and regular HUD orders. Reset creates a fresh repeatable battle.

Validation on 4 October 2026:

- The full runner completed 707/707 files: 700 passed and 7 failed. It reported 4,916 passing tests, 11 failures and 5 skipped tests. The skips follow failed campaign prerequisites.
- All seven failed files were repeated on a clean archive of `46ce4578`. Its nine assertion reports match this branch in location, message, actual/expected values and project stack. Two enclosing failures account for the total of 11. No campaign assertion was relaxed.
- A final crew-playback route correction followed that full run. The final affected controller/effect gate passed 51/51 tests. The separate artillery/crew/presentation gate passed 34/34. Typecheck and the production build passed after the correction.
- Test-shard self-tests passed 5/5; the final shard audit reports complete coverage, including the added controller test. Documentation and baseline audits passed (38/38 baseline checks). The native asset verifier passed all 24 appearance LODs, 244 clips per anatomy, 26 equipment entries and 3 horse LODs. Diff checks passed.
- Browser checks used ordinary controls for rifle fire, grenade release, cannon fire/reload, mounted running and roof climbing. They confirmed AP/ammunition updates, persistent smoke, night lighting, roof cutaways and the selected actor silhouette behind a wall. The actual San Lorenzo screen loaded with HTML portraits and inventory; a rifle discharge and road movement retained their normal costs. Paired-hand anatomy, hidden contacts, life transitions and asset replacement also have focused automated coverage.

Existing failing campaign files: `fresh-coastal-route`, `fresh-northern-route`, `fresh-cuyo-route`, `fresh-ending-route`, `fresh-historical-loss`, `fresh-campaign-recovery` and `opening-playthrough`. Their failures concern observed corpse loot, perfect-equipment repair requests, a lost battle, an active travel route and finite medical supplies/carrying space. These remain outside the renderer change.

### Local performance sample

Apple M2 Max, Codex in-app browser, development build, 1280×720 viewport, 2560×940 drawing buffer, 100% map zoom and human LOD 2. Each row contains twenty one-second FPS readings after assets loaded. No test suite or build ran during the sample. The scenes contain animated idle characters, held equipment, terrain, scenery and shadows. Some edge actors are partly outside the view; all listed actors remain active in the renderer. No projectiles or explosions ran during these samples.

| Active/loaded actors | FPS range | Mean FPS | Draw calls | Rendered triangles | Geometries / textures |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 24 / 24 | 91.0–105.1 | 97.1 | 435 | 567,374 | 207 / 115 |
| 60 / 60 | 72.3–77.0 | 75.4 | 959 | 895,849 | 218 / 151 |
| 100 / 100 | 55.0–60.0 | 59.1 | 1,505 | 1,433,472 | 218 / 191 |

The resource columns are object counts, not GPU memory bytes. These short samples do **not** establish sustained 60 FPS in large battles, during effects, or on other hardware. The 100-character sample falls below 60 FPS. Further mesh/material optimization remains useful. See [recorded samples](sector-performance.json).

The preview remains at `http://localhost:3148/`; the prior playground at port 3147 is preserved. Saves are origin-bound. This is a functional renderer and replaceable art pipeline, not final art polish or a certification of JA2 parity.
