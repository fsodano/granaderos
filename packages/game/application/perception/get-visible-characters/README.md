# GetVisibleCharacters

This read-only use case returns the identities that the observer or observing
force can currently see. Its repository supplies visibility decisions from the
domain perception model. The result contains no hidden character records,
ammunition, action points, or private contact history.

The live `visibleEnemies` and `visibleHostiles` compatibility functions call this
use case, then resolve admitted IDs to their internal simulation records.
`SectorPerception` maps legacy scene fields to `VisionObserver`, `FieldOfView`,
`VisibilityPolicy`, and `IlluminationPolicy`. Geometry remains a supplied adapter;
the domain owns facing, range, illumination, concealment, and smoke thresholds.

`KnownSectorPolicy` also controls the live projectile forecast: hidden characters,
undiscovered interior contents, and unknown reflecting cover cannot reveal the
private scene through a preview. Actual projectile physics still uses the full
physical scene.

No query advances time, spends action points, changes contact history, or mutates
its source snapshot. Verify with `node --test tests/perception-domain.test.ts`
and the tactical, public-journal, and worker integration suites.
