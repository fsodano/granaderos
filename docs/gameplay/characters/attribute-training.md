# Attribute training and saved growth

On the strategic campaign screen and the tactical battlefield, the personnel panel offers the nine classic trainable attributes: health, strength, dexterity, agility, leadership, marksmanship, medicine, mechanics and explosives. Granaderos labels explosives as **Pólvora y artillería** and retains its existing stealth and riding practice. Wisdom affects learning speed but is not an available training subject.

The reference is `GetTrainingStatValue` and `CanCharacterTrainStat` in the [JA2 Stracciatella assignment source at a06f4896](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Strategic/Assignments.cc). This source identifies those nine subjects, excludes wisdom, and checks nonzero aptitude. Granaderos keeps its existing study rates, integer fractional credit, forty-practice threshold, ten earned-point limit and maximum attribute of 100. These numbers and the one-student-per-instructor rule are adaptations, not an exact reproduction of classic JA2 growth.

## Orders and visible progress

In **Asignaciones del personal**, open **Preparar práctica o reparación**, select **Habilidad**, then select **Práctica individual**. To use a teacher, first assign a better soldier as **Instructor** in the same skill and sector; assign the other soldier as **Alumno**. For an existing work assignment, **Aplicar selección** commits a changed subject or teacher.

The selected skill shows current value, remaining earned improvements and productive work hours until the next point. A qualified teacher adds a comparative estimate. This uses the same rate and saved fractional credit as actual hourly work. Rest, travel, unsafe sectors and interruptions can extend the calendar time. Changing subjects does not spend another subject's partial-hour credit. **Aprendizaje por práctica** displays all eleven subjects, existing progress, zero aptitude and completed growth.

The existing work rules still charge both teacher and student time, energy and fatigue, and require them to remain present and available. The estimate does not override assignment eligibility or promise uninterrupted work.

## Field effects and persistence

A successful weapon grab awards dexterity practice, and dexterity is a supported earned attribute in the saved progress schema. Failed, rejected and empty-target attempts do not award it.

Heavy-load tactical marching retains its existing thirty-step threshold and records the improvement through the shared strength-practice limit. Existing carried-load strength values remain a floor when loading older records. New study, field practice and XP growth are not counted twice. Effective strength is transferred consistently into visit, attack, defense and local recruitment requests instead of being replaced by an older stored value.

Health practice increases maximum and current health by the same actual amount, preserving the wound deficit, bleeding and bandages. It cannot revive a dead soldier. Returned practice is applied before medical return validation, so a real new maximum survives a sector report and subsequent entry.

Powder proficiency changes cannon loading work by at most ten percent before integer rounding: skill 50 retains the old baseline, skill zero adds ten percent, and skill 100 removes ten percent. Existing crew and specialist modifiers still apply. This is a period adaptation. Only the assigned crew gains powder practice from a completed load or a shot. Partial loading, turning, moving, rejected orders and nearby observers do not gain it. Ammunition is still consumed once, on completed loading. Fire, move and pivot costs are unchanged by this attribute.

## Hostile firearm near misses

A capable player can attempt agility practice after surviving an actual hostile single-ball miss directed at that person. The reference is `AgilityForEnemyMissingPlayer` and `ShotMiss` in the [pinned JA2 Stracciatella weapon source](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Weapons.cc#L2960). That source checks the opposing team and the player's remaining life. Granaderos applies a tighter physical test and its existing learning rules; it does not reproduce JA2's exact credit amount.

The real paid bullet must pass within 0.9 map cell horizontally and within 0.25 height units of the person's body envelope, before its actual final stop. These distances are Granaderos tuning. A wall or body that stops it before the person, a distant or overhead ray, an actual hit, or redirected injury gives no practice. Friendly fire, point fire, failed ignition, pellets and artillery cannot train agility this way. Dead, critical, unconscious, knocked-down, routed, restrained, surrendered or departed people cannot gain it. Only the intended player is eligible; nearby observers receive nothing.

Each eligible bullet gives one ordinary field-practice attempt. The independent saved `practiceSeed` supplies the Wisdom-dependent roll. Minimum aptitude 35, forty earned credits per point, the ten-point lifetime cap and maximum 100 still apply. A repeated call for the same resolved bullet cannot add another attempt. Learning adds no notice, hidden body identity, combat RNG draw, health, ammunition or treasury credit. Normal and presented execution retain the same authoritative result. Saved progress survives a paid retreat, campaign settlement and reentry; a repeated battle result is rejected.

Physically possible chances below one percent display as “<1%” without a probability floor. The remaining full-video gameplay scope is separate work.

## Remaining scope

The nine study subjects are available; broader field-growth events remain partial. Health and leadership awards for new tactical events, a complete explosives/disarming system, and exact classic training formulas remain open. Overall campaign balance and a full Retiro-only victory remain open. Artwork is maintained separately.
