# RecruitCombatant

Admit an eligible candidate into the player's force with immediate control.
The contract, payment, membership, and placement are accepted together.

`RecruitCombatantUseCase` loads its context through
`RecruitCombatantRepository`. `RecruitmentService` applies the rules through
`Character`, `ForceRoster`, `ServiceContract`, and `Treasury`.

The request supplies a character ID, a supported term, and an optional legal
recruitment site. The current controlled site is the default when available.
The recruit joins the selected squad when it is present and has room. Otherwise,
the recruit is a controlled reserve at the selected site and can be assigned
through the personnel screen. There is no arrival countdown for new recruitment.

A refusal leaves funds, membership, equipment, and service unchanged. The
response supplies placement, assignment, total payment, and service expiry.

The campaign repository maps the existing save representation into domain
objects within the command's shared `GameUnitOfWork`. Initial equipment remains
issued through the custody adapter. Recruitment and the campaign roster use
`CampaignCharacterEquipmentMapper` to resolve the same current weapon, blade,
and authored definitions. The initial cartridge allowance uses that weapon's
ammunition family and is issued once. A returned or removed item cannot inherit
the definition of its initial issue.
Restoration never calls the recruitment use case.

Expected eligibility and service-quote refusals use typed domain codes. The
`CampaignRuleRefusal` infrastructure adapter preserves the detailed player
message from retained campaign policy without moving that text into the domain.
