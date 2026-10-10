# Visible firearm projectiles

Date: 2026-10-10. Base: `b5a4a1141081c0bf19d70567a64ced3fad5154d3`.
Candidate source digest: `d6ad74e11a68ce1af11759f38a28a3750b16028e75fb6e2b2353d9dc68babe37`.

The presentation boundary now retains the observed samples of each resolved firearm path. Previously, it checked those samples for visibility, then gave the renderer only the first and last points. This made the renderer replace a falling path with a straight line.

The public path contains at most 256 coordinate samples. Visibility checks run before this limit is applied. The first and last admitted points remain exact. A hidden continuation has no impact outcome or material. The renderer receives no physical trajectory model, contact proof, victim identity, or complete battle state.

The 3D projectile has a light core and a dark edge. It remains visible until arrival. A bare miss fades at its resolved endpoint without dust, fragments, blood, or a body reaction. A known cover impact has a short contact cue at its admitted point; this also makes a strike readable when force expires inside an opaque rock. The SVG effect follows the same admitted path. Paired shots and later path segments retain separate events. A later segment does not repeat the muzzle discharge.

No combat reducer, weapon definition, collision rule, accuracy rule, action cost, damage rule, ammunition rule, save rule, or simulation random stream was changed.

## Browser review

Open `/renderer-sandbox`, select **Proyectiles**, select a case, then press **F**. Fire at **Blanco**. For the rock case, fire at **F9**. Select **Reiniciar escena** to repeat. These actions use the ordinary tactical reducer and loaded weapons.

| Case | Resolved result | Browser result |
| --- | --- | --- |
| Impacto en personaje | One musket shot; target health 45 | Moving bead, then damage 55 at the target |
| Disparo fallado | Lateral pistol miss; target health 100 | Flight passes away from the body; no body impact effect |
| Impacto en piedra | Stone stops the shot near x=8.019 | Flight ends at the rock; target remains at health 100 |
| Dos pistolas | Primary and offhand shots; target health 14 | Two discharges and flights; target becomes unconscious |
| Caída a larga distancia | Pistol miss; final height about 0.298 m | Long flight across the field; target remains at health 100 |

The browser reported no warnings or errors during the review. The captures are real browser screenshots, taken through normal controls. The local `artifacts/visible-projectiles/projectile-review.mp4` joins them at their measured capture intervals. It is a screenshot sequence, not a continuous frame-rate recording. Captures, timing records, and the clip remain local review artifacts.

## Validation

- The 84 focused tests passed. They cover real curved paths, visibility clipping, private data removal, bounded paths, continuation segments, misses, cover, paired shots, ammunition, saved results, random state, pellets, and artillery.
- Documentation and baseline audits passed.
- Production build and TypeScript checks passed with dependencies from the pinned lockfile.
- The routine test suite completed all 944 files: 941 passed and three asset snapshot cases detected the source edit made during that run. All three affected cases passed on repeat with the source fixed. The complete apparel file passed 27 tests; the two other failed cases passed a targeted repeat. The first routine run itself had three failures and must not be reported as a clean run.

Repeat commands:

```sh
node --test tests/characters-apparel-surfaces.test.mjs
node --test --test-name-pattern='verified selected source patches|coarse donor composition' tests/characters-coarse-garment-surfaces.test.mjs tests/characters-library-pipeline.test.mjs
```

## Existing miss limitation

An accuracy miss can retain a ray that crosses the selected target's cell. The combat rule excludes that selected target from body collision after the failed accuracy roll. For example, seed 45, pistol 1805, skill 1, shooter at (1,3), and target at (7,3) can resolve a miss along y=3. At x=7, the path height is about 1.143 m, but the target receives no damage.

This change draws the resolved path and suppresses hit feedback for that miss. It does not move the ray away from the target. Such a move would invent a path or change downstream collision results. Fixing the geometric overlap requires a separate combat rule change. The lateral review case demonstrates an existing miss that does not overlap the selected body; it does not establish that every accuracy miss avoids a body.

## Integration with main for the pull request

The change was rebased onto `06e55ecc3746931d60a0448c413bb10c64821415`, which includes native shared wall edges. The rebase had no conflicts. Integrated source digest: `9b58b63e155bf5f3e602631f87254d65c5b7057554c2bf02083782449d331c09`.

- 116 focused projectile and native wall tests passed.
- 13 stone reflection and renderer sandbox compatibility tests passed.
- TypeScript checks, production build, documentation audit, baseline audit, test partition coverage, and whitespace checks passed.
- All five browser cases were repeated on this integrated source through ordinary controls. The outcomes matched the table above. The browser reported no warnings or errors. Integrated captures and their timing record remain in `artifacts/visible-projectiles/main-*`; the local clip is `projectile-main-review.mp4`.
- The fresh routine test suite passed all 959 files on the integrated source. The process exited successfully, the timing report marked the run complete, and no file failed. The source remained fixed throughout this run.
