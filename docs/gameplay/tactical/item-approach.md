# Approach and use the held item

During tactical exploration and turn-based combat, selecting a patient or visible opponent while holding medical dressings, a blade, or empty hands moves the acting soldier into contact range and applies the treatment or melee strike in one order. The [classic JA2 manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf), printed page 33 ([M33](../../requirements/ja2-parity.md#scope-and-evidence)), describes selecting a patient with a medical kit in the main hand: the medic moves next to the patient and applies aid. Granaderos uses that interaction for held dressings, blades and empty hands. The player does not need a separate Charge or Heal command.

## Rules

- Select the item first. Changing hands still costs 4 AP in combat.
- Select a valid patient or visible opponent. The shared preview finds the cheapest reachable contact cell and shows movement AP plus treatment or attack AP. An unaffordable order shows its full cost and spends nothing.
- Firearms retain ranged targeting. A fitted bayonet retains the existing close-range contextual thrust rule.
- Movement uses ordinary terrain, posture, energy, fatigue, collision and reaction rules. Hidden opponents do not change the planned route. An actual hidden obstruction stops movement instead of causing a secret detour.
- Combat charges the round clock once. Exploration charges each completed movement step and the treatment time separately.
- Contact, an enemy reaction, collapse, target loss or a blocked route can stop the order. A reaction on the final approach tile also stops use. Completed movement costs remain spent; the dressing or attack is not used. Select the target again after reviewing the changed situation.
- Treatment stops bleeding and records bandaged wounds. It does not restore health. Dressings remain finite.

There is no saved pending order. The ordinary battle snapshot preserves any completed movement and reaction window. Direct `heal` and `melee` API aliases still require the target to be in reach. Ordinary door and container targeting shares this approach executor; see [environment approach](environment-approach.md). Ground equipment and body searches use an [approach and quantity picker](loot-approach.md). Giving and contested weapon grabs remain local.

## Limits

Movement and use AP values remain Granaderos tuning. The approach covers the
interaction stated above; further JA2 interaction parity is tracked in the
[JA2 parity requirements](../../requirements/ja2-parity.md).
