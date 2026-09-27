# Artillery loading across turns

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

This extends the existing period artillery model. It follows the same retained-work rule as handheld loading; it does not claim that classic JA2 contains these field guns or their exact crew costs.

## Rules and controls

Select a cannon in the artillery controls, then use **Recargar pieza**. The control displays the AP paid by each assigned artillerist in this step and the AP still needed afterward. The cannon selector displays the completed percentage. A loaded cannon cannot be reloaded, and an unfinished load cannot fire.

Loading progress belongs to the cannon. The whole required crew works simultaneously, so the member with the least available AP limits the step. The selected leader must participate. When extra helpers are present, the reload chooses capable helpers with more AP first, using stable ID ordering for ties. It does not spend an unassigned soldier's AP. The existing specialist modifiers apply to the unfinished fraction when leadership changes.

Each successful partial step charges the same AP to every assigned member. The charge remains in reserve until the load is complete. Completion consumes exactly one reserve shot and removes the progress field. Moving or turning the piece preserves unfinished loading work. Changing crews does not reset it. No reserve shot means work is blocked, but retained progress remains intact.

Crew selection for all artillery orders now shares the same authority checks between HUD and reducer: same side and control class, conscious, on foot, present, adjacent through unobstructed geometry, and available in the current turn or interrupt. A hired soldier cannot commandeer militia AP. Every assigned crew member lowers their held weapon when handling the cannon.

During exploration, artillery work advances time once for the simultaneous crew action and does not subtract combat AP. One second minimum and the existing 0.06 seconds per AP conversion apply. These rates, crew sizes, abstract loading fraction, and simultaneous-work policy are Granaderos tuning.

## Persistence and scope

`reloadProgress` is an optional fraction strictly between zero and one on an unloaded cannon. Battle validation rejects nonfinite, nonnumeric, out-of-range, or loaded-cannon work. Active full campaign saves retain it. The public projection exposes friendly cannon work but keeps enemy loading and ammunition private, even for an observed piece.

This change covers the active encounter, saved continuation, dragging, turning and replacement crews. [Stationed artillery](../campaign/stationed-artillery.md) now also retains each issued cannon, its ammunition and unfinished loading across strategic returns and reentry. Recovery and strategic transport of these stationed pieces, and autonomous AI artillery selection, remain incomplete.

## Verification, 2026-09-12

Fourteen simulation tests cover wounded crews across actual turns, finite ammunition, limiting crew AP, spare helpers, independent guns, movement and leader changes, specialist rates, invalid orders, interrupt authority, exploration timing, shared readiness, validators, public projection, and full campaign encoding/decoding. The seven existing artillery tests remain unchanged and pass. Two production `JA2Strip` render/input tests verify cost text, percentage, disabled state, and the real emitted reload order.

The complete existing suite plus the new simulation cases passed **1,411 tests**. The two subsequently added UI cases also passed. Type checking, production build, and whitespace checks passed.

A separate browser harness mounted the production `Battlefield`, `JA2Strip`, and reducer. Three wounded soldiers had 22 AP per turn. The heavy cannon loaded over four actual turns: 22 + 22 + 22 + 9 AP per person. The browser showed 29%, 58%, and 88% before completion; all three reserve shots remained until the fourth step, which left one prepared shot and two reserves. Each soldier retained 13 AP after the final step. Validated save/restore retained both the first partial step and the completed load. The harness did not access the user's campaign save.

The same browser run then used two ordinary end-turn actions to carry enough AP for firing (35, then 42 per soldier). Selecting the cannon fire control and confirming tile D11 fired the prepared shot, left both reserve shots unchanged, and charged 40 AP to each of the three crew members. Each retained 2 AP afterward.
