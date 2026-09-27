# Background group route previews — 2026-09-26

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

The main battlefield no longer calculates formation previews during React
rendering. Opening **Ruta del grupo** enables a separate preview worker. Closing
the detail, clearing the selection, changing the battle or starting an order
invalidates the pending preview.

The preview queue allows one active calculation and one latest replacement.
Intermediate pointer destinations are discarded. A result is displayed only for
the same battle snapshot and request. The command worker remains separate, and
the formation executor still validates and plans each actual order again.

If the preview worker fails, the panel explains that the route will be checked
when the order is issued. It does not run the expensive preview synchronously as
a fallback. Actual orders retain their existing fallback and validation rules.

## Validation

- 38 focused tests passed, covering worker equivalence, complete and partial
  formations, contact stops, invalid requests, rapid preview replacement, stale
  failures, queue cancellation, rendering and campaign integration.
- Type checking and the production export passed.
- The production **root campaign page**, using its isolated QA save key, was
  tested through Importar partida and Continuar campaña. No performance route
  was used for this browser check.
- The imported campaign was created through normal recruitment of IDs 110–115
  and a normal Retiro sector visit. Its remaining treasury was 2,283 pesos; no
  resources, positions or victories were injected.
- Six soldiers were selected through the squad strip. Opening the route detail
  and focusing R24 displayed the calculation status, then all six routes.
- Rapid focus changes through O24, P24 and R24 produced the final R24 formation,
  without displaying an obsolete destination afterward.
- Executing the ground-cell order produced a completed group report with 54
  seconds elapsed. The six soldiers occupied R24 through W24. Reloading the page
  and continuing the campaign retained all six positions.
- Browser warnings and errors were empty.

## Limits

This check proves the group preview's shared runtime connection and stale-result
handling. It is not a full 60 FPS acceptance test. The selected soldier's ordinary
reachable-area calculation is still synchronous, as are other preview classes.
Initial scenery conversion and complete enemy-turn frame-time coverage remain
open, along with the other gameplay and artwork requirements.
