# Revised campaign start and recruitment

The active user objective supersedes earlier decisions about a pre-hired squad and the map dashboard. Player-facing text remains Spanish; code and documents remain English.

## Required end state

1. New campaigns have no pre-hired characters. No Cabral/Dorrego/Paroissien starter trio.
2. Start at the Escritorio. Sidebar sections: objectives/overview, create your Granadero once, paid recruitment. Access strategic map separately.
3. Create one personal character: name/nickname, selectable portrait, base stat allocation, era-appropriate class (e.g. Gaucho or Soldier), questionnaire that derives skills and personality. Skills such as expert riding, night operations and teaching must affect actual play, not only labels. Optimism/pessimism must define characterization.
4. Paid recruits are plausible paid volunteers/mercenaries, not major historical leaders. Each has a complete playable profile. Day/week/month contracts charge finite prices, expire, renew, and increase requested pay with experience. Elite candidates permit only one-day contracts.
5. Simplified strategic screen: current personnel, map with delimited cities/areas, desk access, travel/tactical entry, time and militia orders. Existing production/diplomacy capabilities remain accessible from the desk rather than overwhelming the map.
6. Militia requires complete control of every sector in a city and sufficient loyalty. NPC quests and enemy victories increase loyalty. UI should make eligibility obvious and training easy to order.
7. Persist important decisions/evidence in docs/*.md.

## Reference evidence

- Attached image-1 shows IMP identity entry (name/nickname/gender), images 2 and 3 show questionnaire choices; these are references, not instructions to reproduce modern jokes or the laptop aesthetic.
- User-linked IMP wiki initially returned a restricted fetch. Research continues through reachable references/source.
- No Patusco PDF is present in the supplied attachment folder; it contains only the three PNGs. Find an accessible copy online or identify the missing attachment precisely, without blocking independent implementation.

## Work allocation

- campaign_data: empty new-game lifecycle, finite paid contracts, expiry/renewal, save compatibility and campaign wiring.
- engine_build: character creation model, classes/questionnaire/attributes, creator UI and actual trait effects.
- graphics: city boundaries, control/loyalty eligibility and quest helpers (game design subtask).
- root: reference research, simplified strategic map, sidebar desk, recruitment catalogue/dossiers and integration/browser verification.

Existing saves are preserved as legacy campaigns; the new-start behavior applies to new campaigns. Old tests expecting a pre-hired trio are not proof of the new goal and must be deliberately migrated to explicit setup helpers rather than restored as product behavior.

## Authorization and references update

User explicitly authorizes opening and merging progress PRs at our discretion after verification. Preserve milestone notes and remaining-work audit.

Accessible reference: Patusco's JA2 Strategy Guide v1.3 (2000), https://draketungsten.org/arcade/pcmanuals/ja2_guide.pdf . IMP wiki search indexing also exposes its creation sequence; official 1.13 project documentation at https://1dot13.github.io/documentation/playing/features/imp/ provides the attribute-budget model. Adapt mechanics; do not transplant modern content or copyrighted prose.

## Reference-derived design notes

Patusco v1.3 sections 1.8 and 3.2 inform the split between identity, questionnaire, attribute allocation and strategic instruction. Leadership and teaching should change training duration; loyalty affects local cooperation. Contract renewal is an explicit economic decision. These mechanics are adapted to a provincial military setting; modern weapons, equipment, agency websites and questionnaire jokes are excluded. The user's day/week/month periods and elite one-day restriction take precedence over the guide's original contract choices.

## Current integration decisions

- New games open the sidebar desk. The map contains personnel, a sector grid with visible city boundaries, time controls and contextual travel/training. Workshops, diplomacy and journal are desk folders.
- Four unique fictional player avatar choices replace reuse of named paid recruits.
- Buenos Aires operational city area includes Plaza Mayor, Retiro and Ensenada. This is gameplay grouping, not a claim about historical municipal borders. Other settlement areas and rural passes are explicitly enumerated in game/cities.js.
- Paid catalogue contains fictional volunteers; all historical figures use local encounters.
- Preserve old campaigns and mark old subsystem fixtures as legacy; new-flow acceptance must exercise an empty new state.
