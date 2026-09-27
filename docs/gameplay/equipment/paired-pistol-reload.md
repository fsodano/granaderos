# Automatic loading of two held pistols

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

R and an empty-gun firing click now use the same automatic reload plan. It fills the main pistol first. If reserve cartridges and enough AP remain to finish the second pistol, it loads that gun too. The cursor shows the combined cost and the cartridges loaded into each hand. Confirmation only reloads; firing is a separate order.

If the second operation does not fit, the second gun stays unchanged and the soldier keeps the AP left after the first. A pair costing 32 + 28 AP uses 60 AP when available. With 59 AP, it spends 32 and keeps 27. The preview and combat log explain the pending second load.

With a full main gun, another R directly continues the second pistol. This operation permits partial work so a wounded soldier with a small AP allowance can finish loading over turns. There is no swap, duplicate cartridge or free work. For example, 27 AP of a 28-AP second reload survives saving and needs only one AP on the next turn. Each gun keeps its own load, condition, identity, fittings and unfinished fraction. A cartridge leaves reserve only when its charge completes.

Only two physically held pistols qualify. A pocketed, failed, broken, non-pistol or absent second weapon never joins. A primary cazoleta failure keeps the existing R reprime behavior. The existing R key now also services a failed second cazoleta without a hand swap, with separate finite powder and AP costs; see [paired pistol priming](paired-pistol-reprime.md). Broader autonomous equipment selection remains open.

In exploration, the same finite loading work consumes elapsed time and supplies without spending AP. Two empty double-barrel pistols require 110 AP-equivalent work, seven exploration seconds and four reserve cartridges. The shared plan also governs enemy maintenance. A loaded main gun retains its existing firing priority instead of forcing a second-gun reload before every shot.

## Original source and period adaptations

The pinned classic-compatible [AutoReload implementation](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Items.cc#L1418-L1465) reloads the main hand, finds remaining ammunition for the other hand and checks whether its loading cost still fits. Its [AP preview](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Points.cc#L1453-L1524) counts the second cost only when both are affordable. Granaderos follows that sequence and fallback rather than treating simultaneous firing as simultaneous loading.

The 100-point scale, weapon-specific muzzle-loading times, shared finite cartridge reserve, saved partial charges and explicit full-main/partial-second continuation are period-game adaptations. This implementation does not introduce JA2 magazines or claim its modern-firearm timings.

## Verification

All 2,196 tests pass, with no skips. Typecheck, production build, static export verification and diff checks pass. The browser reported no warnings or errors.

Twenty-four added tests cover model, input, rendered controls, AI and a purchased second pistol through the actual campaign inventory, tactical loading, firing, full save, report and reentry. Boundaries include scarce ammunition, 59/60 AP, double barrels, separate saved fractions, real enemy turns, a genuine saved interruption, invalid actor rollback, hidden-target independence and zero-AP exploration. Single-gun and existing paired-fire checks remain in the full suite.

Live checks use a disposable practice scene with the production Battlefield, equipment controls and reducer, without accessing campaign storage:

- R loaded both single-shot pistols: 100 → 40 AP, reserve eight → six, and both charges zero → one. Both conditions remained unchanged.
- With 59 AP, R loaded the main pistol for 32 AP and preserved the other gun and 27 AP. A second R stored 27 AP of second-gun work without consuming a cartridge. Save/restore, a real turn change and R finished it for one AP and one cartridge.
- The empty firing cursor showed both hands and 60 AP. Clicking loaded both guns while the selected enemy stayed at 100 health.
- Exploration loaded both double-barrel pistols from eight reserve cartridges to four, with no AP charge in the interface or log.
- Exhausted reserve retained the crossed-out aiming cursor and no-ammunition explanation.

Broader parity remains tracked in the [current audit](../../verification/ja2-parity-audit.md).
