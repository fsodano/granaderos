# Approach and use the held item

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

The JA2 manual, printed page 33, describes selecting a patient with a medical kit in the main hand: the medic moves next to the patient and applies aid. Granaderos now uses that interaction for held dressings, blades and empty hands. The user does not need a separate Charge or Heal command.

## Rules

- Select the item first. Changing hands still costs 4 AP in combat.
- Select a valid patient or visible opponent. The shared preview finds the cheapest reachable contact cell and shows movement AP plus treatment or attack AP. An unaffordable order shows its full cost and spends nothing.
- Firearms retain ranged targeting. A fitted bayonet retains the existing close-range contextual thrust rule.
- Movement uses ordinary terrain, posture, energy, fatigue, collision and reaction rules. Hidden opponents do not change the planned route. An actual hidden obstruction stops movement instead of causing a secret detour.
- Combat charges the round clock once. Exploration charges each completed movement step and the treatment time separately.
- Contact, an enemy reaction, collapse, target loss or a blocked route can stop the order. A reaction on the final approach tile also stops use. Completed movement costs remain spent; the dressing or attack is not used. Select the target again after reviewing the changed situation.
- Treatment stops bleeding and records bandaged wounds. It does not restore health. Dressings remain finite.

There is no saved pending order. The ordinary battle snapshot preserves any completed movement and reaction window. Direct `heal` and `melee` API aliases still require the target to be in reach. Ordinary door and container targeting now shares this approach executor; see [environment approach](environment-approach.md). Ground equipment and body searches now have an [approach and quantity picker](loot-approach.md). Giving and contested weapon grabs remain local.

## Verification

Thirteen `item-approach.test.mjs` cases cover exact move/use equivalence, blades, punches, ranged guns, unaffordable and invalid orders, detours, exploration bleeding, collapse, patient death, hidden obstruction, first contact, final-tile reactions, saved player interrupts and shared HUD costs.

The live medical check equipped Paroissien's dressings, previewed 42 AP (24 movement plus 18 treatment), and selected Cabral once. Paroissien moved three tiles, spent exactly 42 AP and one dressing, and stopped Cabral's bleeding without changing his 50 HP. A fresh tab restored the same public unit records and six-second clock. See [the live record](../../verification/ja2-live-verification.md).

Melee approach and interrupted approach have simulation coverage but were not exercised through live browser input in this check. AP values remain Granaderos tuning. This implements the stated interaction; it does not establish complete JA2 feature parity.
