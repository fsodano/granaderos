# Attribute training and saved growth

The personnel panel now offers the nine classic trainable attributes: health, strength, dexterity, agility, leadership, marksmanship, medicine, mechanics and explosives. Granaderos labels explosives as **Pólvora y artillería** and retains its existing stealth and riding practice. Wisdom affects learning speed but is not an available training subject.

The reference is `GetTrainingStatValue` and `CanCharacterTrainStat` in the [JA2 Stracciatella assignment source at a06f4896](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Strategic/Assignments.cc). This source identifies those nine subjects, excludes wisdom, and checks nonzero aptitude. Granaderos keeps its existing study rates, integer fractional credit, forty-practice threshold, ten earned-point limit and maximum attribute of 100. These numbers and the one-student-per-instructor rule are adaptations, not an exact reproduction of classic JA2 growth.

## Orders and visible progress

In **Asignaciones del personal**, open **Preparar práctica o reparación**, select **Habilidad**, then select **Práctica individual**. To use a teacher, first assign a better soldier as **Instructor** in the same skill and sector; assign the other soldier as **Alumno**. For an existing work assignment, **Aplicar selección** commits a changed subject or teacher.

The selected skill shows current value, remaining earned improvements and productive work hours until the next point. A qualified teacher adds a comparative estimate. This uses the same rate and saved fractional credit as actual hourly work. Rest, travel, unsafe sectors and interruptions can extend the calendar time. Changing subjects does not spend another subject's partial-hour credit. **Aprendizaje por práctica** displays all eleven subjects, existing progress, zero aptitude and completed growth.

The existing work rules still charge both teacher and student time, energy and fatigue, and require them to remain present and available. The estimate does not override assignment eligibility or promise uninterrupted work.

## Field effects and persistence

A successful weapon grab already awarded dexterity practice, but dexterity was absent from the saved progress schema. An ordinary-skilled soldier could therefore take a weapon and produce an invalid save. Dexterity is now a supported earned attribute. Failed, rejected and empty-target attempts do not award it.

Heavy-load tactical marching retains its existing thirty-step threshold and now records the improvement through the shared strength-practice limit. Existing carried-load strength values remain a floor when loading older records. New study, field practice and XP growth are not counted twice. Effective strength is transferred consistently into visit, attack, defense and local recruitment requests instead of being replaced by an older stored value.

Health practice increases maximum and current health by the same actual amount, preserving the wound deficit, bleeding and bandages. It cannot revive a dead soldier. Returned practice is applied before medical return validation, so a real new maximum survives a sector report and subsequent entry.

Powder proficiency now changes cannon loading work by at most ten percent before integer rounding: skill 50 retains the old baseline, skill zero adds ten percent, and skill 100 removes ten percent. Existing crew and specialist modifiers still apply. This is a period adaptation. Only the assigned crew gains powder practice from a completed load or a shot. Partial loading, turning, moving, rejected orders and nearby observers do not gain it. Ammunition is still consumed once, on completed loading. Fire, move and pivot costs are unchanged by this attribute.

## Verification

- Nine model tests check the subject set, zero/dead/enemy guards, invalid requests, multiple gains, both caps, fractional legacy attributes, wound preservation, study forecasts and powder costs/crew practice.
- Twelve lifecycle tests check actual weapon theft, complete campaign/battle saves, a paid retreat, reentry, study of each newly supported subject, legacy strength, XP growth across all three deployment paths, and the health return boundary.
- Three component tests check all eleven labels, zero/capped progress, teacher estimates and the real personnel panel's options and saved selection.
- The existing exploration and artillery tests cover the retained heavy-load threshold and updated costs for a real low-powder-skill commander.

Live browser checks used the production personnel/progress components, campaign reducer, battle handoff and save encoder/decoder. A fresh Retiro-only campaign paid for Acosta and Ledesma. Leadership showed 45 productive hours alone or 23 with Ledesma; after pairing and one real hour, both soldiers had 97 energy, Acosta had 1/40 practice, and save/load preserved the assignment and progress. The estimates fell to 43 and 22 hours respectively because the saved fractional credit was retained.

A separate, labelled near-gain fixture gave Acosta 39 health practices, partial-hour credit and a five-point bandaged wound. One real hour changed health from 80/85 to 81/86, charged energy and kept the five-point wound. Full save/load and a saved peaceful visit/return retained 81/86. This fixture does not claim that one fresh hour earns a whole health point. The weapon-theft, artillery, XP and hostile-return evidence is automated, not a live visual check.

The local practice is available at `http://127.0.0.1:3046/` while its preview server runs. It uses isolated in-memory state and does not read or replace the user's campaign storage.

The complete suite passed **2,242/2,242 tests**, with no skips. Type checking and the production build passed; static export verified 960 files and 856 asset references. The live browser reported no errors or warnings.

## Remaining scope

The nine study subjects are available; broader field-growth events remain partial. This change does not add health or leadership awards for new tactical events, a complete explosives/disarming system, or exact classic training formulas. Existing overall campaign-balance and full Retiro-only victory verification remain open. Artwork is maintained separately.
