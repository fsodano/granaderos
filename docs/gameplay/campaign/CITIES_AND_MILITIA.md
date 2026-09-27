# Operational areas and militia eligibility

`game/cities.js` is the shared source for strategic boundaries, loyalty and
militia control checks. These are deliberately schematic operational areas,
not surveyed historical municipal boundaries. Buenos Aires groups Plaza Mayor,
Retiro and the Ensenada supply port. Ensenada is not represented as an actual
neighborhood of the historical city. The campaign's other populated centers
are separate one-sector areas. Uspallata, Los Patos and Humahuaca represent rural
passes/posts in this map and do not host militia training.

`militiaEligibility(state, sectorId)` requires every sector in the selected
area to belong to the patriots, plus area loyalty of at least 50. Area loyalty
is the rounded-down arithmetic mean of constituent sector loyalty values.
Missing sector state counts as uncontrolled and zero loyalty. The helper gives
a stable result code and Spanish explanation for both orders and map UI.
Trainer availability, presence, finances, rank and capacity are separate checks.
An ongoing course should pause if the area loses eligibility; local occupation
can retain the existing campaign's course-disbanding behavior.

`recordCityLoyalty(state, {sectorId, kind, eventId})` applies a validated campaign
outcome to every sector in the area and stores a persistent outcome record.
Quests grant 8 loyalty, victory 10, successful defense 3, defeat removes 12.
Values clamp at 0 and 100. Stable battle/quest IDs make repeated outcomes
idempotent; the ledger survives save/load. A rural outcome makes no city award.
The helper must be called only after actual quest or combat success is checked;
it is not a direct player command. `validCityLoyaltyEvents` validates saved rows.

Militia instructors with the questionnaire's canonical `teacher` trait take
25 percent less time. That multiplier stacks with the existing specialist
bonus; troop count and resource costs remain unchanged. The teacher is a skill,
not a character class.

Verification: `node --test tests/cities.test.mjs` checks map partition, partial
regional control, threshold boundaries, rural rejection, quest/combat gains,
deduplication after save/load, saturation/losses and the teacher time bonus.
Campaign wiring is owned separately from these reusable helpers.
