# Slice 52: care defaults belong to the domain

Care settings have two sources: defaults shared by the game and values authored
in a campaign package. The domain owns the defaults. The campaign-content
lookup selects authored values and applies those defaults, keeping campaign
content outside the domain.

## Domain-owned defaults

[`care-rules.ts`](../../../../packages/game/domain/personnel/care-rules.ts)
defines the frozen `DEFAULT_CARE_RULES` for medical skill, treatment healing,
dressing price, care costs, and rest recovery and healing. It also defines
`DEFAULT_STRATEGIC_BLEEDING_PERCENT` as 25. The domain does not read a campaign
package.

## Campaign-authored values

[`campaign-care-rules.js`](../../../../packages/game/campaign-care-rules.js)
keeps the `careRules(campaign)` lookup. It selects the authored
`campaign.contentCampaign.package.careRules`, or returns `DEFAULT_CARE_RULES`
when a campaign has no care rules. `strategicBleedingPercent(campaign)` reads
the optional `bleedingDamagePercent` from those rules and uses the domain's
25-percent default when the campaign omits it.
[`campaign-rules-schema.js`](../../../../packages/campaign-format/campaign-rules-schema.js)
continues to define and validate the authored fields.

As an illustrative input, an otherwise valid authored care-rules record that
sets `baseHealing` (base health restored per treatment hour) to 4 but omits
`bleedingDamagePercent` uses the authored healing value and the domain's
25-percent default for strategic bleeding.

The tests in
[`care-rules.test.ts`](../../../../packages/game/domain/personnel/care-rules.test.ts)
cover the default values, their frozen state, and the default bleeding
percentage.
