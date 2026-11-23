# Slice 54: care tuning and refill price

Care uses domain tuning for its default rest-healing duration. Resupply quotes
take the active campaign's dressing price; the equipment helper does not assign
one.

## Care tuning

[`care-rules.ts`](../../../../packages/game/domain/personnel/care-rules.ts)
owns `DEFAULT_CARE_RULES`, including its `restHealingHours` field.
[`campaign-care-rules.js`](../../../../packages/game/campaign-care-rules.js)
selects authored care values or those domain defaults. Medical care and
strategic rest read the effective duration through that lookup; neither
[`medical-care.js`](../../../../packages/game/medical-care.js) nor
[`strategic-rest.js`](../../../../packages/game/strategic-rest.js) defines a
separate rest-healing constant.

## Refill price

[`refillCost`](../../../../packages/game/equipment.js) takes a record of carried
supplies and an explicit `dressingPrice` per dressing. Its calculation has no
fallback price; omitting the argument returns `NaN` (not a valid price), even
when no dressings are needed.
[`workshopServiceQuote`](../../../../packages/game/workshop-service.js) supplies
the effective campaign price from `careRules(s).dressingPrice`, where
`careRules` selects authored care values or domain defaults.
