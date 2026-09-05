# Revised new-start completion audit

Audit scope: the seven numbered requirements in REVISED-CAMPAIGN-DESIGN.md.
Source, backend and desktop browser acceptance completed on 2026-09-05.
This covers the revised campaign-start milestone, not complete-game QA or public deployment.

## Evidence by requirement

1. **Empty campaign start — implemented.** `initialCampaign()` in
   `game/campaign.js` initializes `recruited`, `squad` and first squad members
   empty, with no officer or contracts. `tests/contracts-web.test.mjs` starts
   from that real initializer, creates exactly one officer, hires a volunteer,
   travels, enters a sector and round-trips a save. The separate San Lorenzo
   skirmish retains a historical squad; it is not the new campaign path.

2. **Desk first, sidebar and separate map — implemented in source.**
   `web/app/page.tsx:newCampaign` selects `desk`. `Desk.tsx` provides Resumen,
   Tu granadero, Contrataciones, Correspondencia, Maestranza, Cabildo and
   Cuaderno folders, with a separate Carta de operaciones button. The backend
   rejects creating a second officer and the desk replaces creation with the
   existing officer summary. Browser navigation was exercised in the isolated QA campaign.

3. **Personal character — implemented; initial audit findings resolved.**
   `CharacterCreator.tsx` exposes name, four original fictional avatar choices,
   four era-inspired occupations, ten allocated attributes and questionnaires.
   `game/character-profile.js` enforces exactly 550 points, each 35–85, and
   validates all choices. The UI filters `avatar-*`; IDs 103/104 still present
   in model validation are legacy compatibility, not selectable new faces.
   Expert riding changes mounted movement through ridingSkill, night skill
   changes night visibility, and teacher reduces actual militia course hours.
   Optimism/pessimism change starting morale and event dialogue in
   `game/characters.js` and `game/character-events.js`. Character-profile tests
   exercise these effects, rather than only checking labels.

   The creator now exposes an optional Apodo field. `character-profile.js`
   validates at most 16 characters without markup/control characters and stores
   the chosen nickname, falling back to the prior derived nickname when blank.
   `campaign.js:createOfficer` now sets creationCost to zero for version-2
   profiles; the 300-peso fee remains only for the legacy profile-less path.
   These source changes resolve both initial audit discrepancies.

4. **Paid fictional catalogue and finite contracts — implemented.**
   `Recruitment.tsx` filters the roster to CIVIC_RECRUITS, offers portraits,
   profile modal, day/week/month quotes, hiring, renewal and dismissal.
   `CharacterDossier.tsx` displays attributes, skills, equipment, biography and
   characterization. `game/contracts.js` quotes 24/168/720-hour periods, raises
   daily pay by 10% per 100 XP, and restricts elite terms to one day. Elite
   renewals do not stack beyond 24 hours from the current time. Campaign ticking
   expires contracts and removes service safely. Named historical figures are
   local encounters and cannot be bought through the paid recruit action.
   Tests cover expiry, renewal, price growth, elite enforcement, dead recruits,
   and legacy save migration. Dossiers now display current daily pay and explicitly label daily-only elites.

5. **Simplified strategic screen — implemented in source.** `Campaign.tsx`
   now renders current personnel, active squad, a 16×16 schematic grid containing
   the 13 authored campaign sectors, city-edge lines, time controls, desk access,
   travel/tactical entry and contextual militia orders. Production, diplomacy
   and journal remain in CampaignOffice through desk folders. No claim is made
   that all 256 grid cells are playable. Current city boundaries are gameplay
   operational groupings documented in CITIES_AND_MILITIA.md; the Buenos Aires
   region includes Retiro and the separate Ensenada port, not a historical
   municipal boundary. The desktop map layout was inspected in the browser; mobile acceptance remains outside this milestone.

6. **City control, loyalty and militia — implemented.** `militiaEligibility`
   requires all city sectors patriot and rounded-down mean loyalty >=50. Rural
   passes cannot train militia. Campaign start checks this helper; ongoing
   courses pause when eligibility is lost. `recordCityLoyalty` awards quests +8,
   victories +10 and defenses +3, records stable outcome IDs, and rejects repeat
   awards. Campaign NPC quest completion and battle results call it; save
   validation preserves the ledger. Quest tests exercise physical adjacency,
   offered/completed stages, goods delivery and exactly-once loyalty gain.
   Map orders display controlled-sector count, loyalty and eligibility reason,
   then instructor, price and duration. Paused courses also display the eligibility or supply reason.

7. **Persistent decisions and evidence — implemented.** Revised design,
   CITIES_AND_MILITIA.md, PROGRESS.md, CHANGELOG.md, original-avatar
   documentation in assets/CUSTOM_AVATARS.md and this audit retain decisions and checks.
   Full browser acceptance and final milestone status remain the root task's
   responsibility; these documents do not replace that verification.

## Verification executed in this audit

`node --test tests/contracts-web.test.mjs tests/character-profile.test.mjs
 tests/cities.test.mjs tests/quests-web.test.mjs tests/operative-profiles.test.mjs`

Result: 26 passed, 0 failed. This checks the backend behaviors above; it does
not establish that every rendered button, responsive layout or deployment works.

## Completion judgment

All seven requirements have concrete implementation evidence after the nickname
and version-2 creation-cost fixes. Browser acceptance should explicitly check empty desk,
four custom avatars, questionnaire allocation, paid dossier/terms, map boundaries,
city eligibility and save/resume using the real new campaign path.


## Final integrated acceptance

The root task exercised a separate `?qa=1` save, preserving the user's campaign:

- Nueva campaña opened Escritorio with zero troops and 3,200 pesos.
- Created Elena Aguirre once, with nickname, scout portrait, Baqueano class,
  manually allocated 550 points and teacher/optimist answers. Creation was free;
  the creation form became the existing character summary.
- Hired Sosa for a week (42 pesos) and Arnaud for a day (50 pesos). Elite weekly
  and monthly options were disabled. Later hired Morel for a month (360 pesos).
- Inspected the simplified map with three personnel, permanent/finite service,
  city boundaries, 3/3 Buenos Aires sectors and 65% initial loyalty.
- Trained militia with the custom officer and advanced 24 hours: three defenders
  completed, Arnaud expired, Sosa retained 144 hours, the officer remained.
- Entered Retiro, approached its sergeant using the new conversation movement
  action, accepted and delivered the ten-textile quest. Map loyalty became 74%
  after training and the quest; automated tests cover duplicate-award rejection.
- Resumed the saved campaign and inspected Arnaud's original portrait, complete
  attributes, class, equipment, personality, speech and daily-only dossier price.

Final checks: all 192 tests pass, TypeScript `--noEmit` passes, production build
passes and verifies 166 exported files with 82 asset references. `git diff
--check` passes. Legacy subsystem fixtures are explicit; fresh-start tests use
actual empty initialization.

### Mapping to the user's original seven points

1. Empty start: covered by initializer tests and browser zero-personnel desk.
2. Personal character: allocation, classes, questionnaire effects and once-only
   creation covered by backend tests and browser creation/save/resume.
3. Patusco reference: inspected the accessible guide; adapted creation, training,
   loyalty and contracts. Sources and departures are in REVISED-CAMPAIGN-DESIGN.md.
4. Simpler map, initial desk, paid complete characters and term/pay rules: tested
   as above, with backend XP price and elite renewal enforcement tests.
5. City-wide control/loyalty eligibility, NPC quests and victory rewards: city,
   quest and campaign tests plus actual browser training and quest delivery.
6. JA2-inspired mechanics with era classes: implemented adaptations, not a claim
   of complete engine parity. Only 13 authored sectors are playable.
7. Persistent decisions and evidence: this audit, revised design, city rules,
   WEB-SYSTEMS.md, CHANGELOG.md and PROGRESS.md preserve implementation state.
