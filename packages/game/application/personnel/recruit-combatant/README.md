# RecruitCombatant

## Intention

Admit an eligible candidate into the player's force with immediate control, valid placement, and an active `ServiceContract` in one transaction.

## Actor and trigger

The player invokes this use case from the recruitment screen (or through a recruitment command alias) to hire a candidate for a selected service term and safe recruitment site.

## Request

`RecruitCombatantRequest` contains:

- `characterId`: the persistent `Character` identifier of the candidate.
- `term`: the requested service term identifier.
- `locationId`: an optional safe recruitment location identifier. When omitted, the use case selects the first legal location in `allowedLocations` (which prefers the active squad's current location when safe).

## Response

`RecruitCombatantResponse` contains:

- `characterId`: the admitted `Character` identifier.
- `locationId`: the sector location where the combatant is placed.
- `assignment`: `'squad'` when the recruit joins the active `Squad` at `locationId`, or `'reserve'` when placed in the controllable reserve at `locationId`.
- `paidPesos`: total pesos charged from `Treasury` (service payment plus any guarantee deposit).
- `serviceEndsAtSeconds`: the `ServiceContract` expiry in `GameTime` seconds, or `null` for permanent service.

## Refusals

Expected refusals throw `DomainRefusal` (or its infrastructure subclass `CampaignRuleRefusal`, which retains the typed `DomainRefusalCode` alongside retained campaign rule details):

- `DomainRefusalCode.InvalidValue`: `characterId` or `term` is empty, or service terms/durations are invalid.
- `DomainRefusalCode.CandidateIneligible`: the candidate fails campaign recruitment eligibility checks (`CampaignRuleRefusal`).
- `DomainRefusalCode.ServiceTermsUnavailable`: the requested service term is unavailable for the candidate (`CampaignRuleRefusal`).
- `DomainRefusalCode.CharacterUnavailable`: the `Character` is dead or captured.
- `DomainRefusalCode.AlreadyServing`: the `Character` is already serving in `ForceRoster` or holds an active `ServiceContract`.
- `DomainRefusalCode.InvalidPlacement`: no legal recruitment site exists or `locationId` is not in `allowedLocations`.
- `DomainRefusalCode.InsufficientFunds`: `Treasury` cannot cover `payment.plus(guarantee)`.
- `DomainRefusalCode.TransactionClosed`: `commit` is called more than once or with mismatched recruitment context.

UI adapters translate refusal codes into Spanish player-facing messages.

## Invariants

- A refusal leaves `Treasury`, `ForceRoster`, `Squad` membership, equipment custody, and `ServiceContract` records unchanged.
- An accepted recruitment charges `Treasury` once, starts `ServiceContract` at the current `GameTime`, admits the `Character` into `ForceRoster`, and places the combatant either in the active `Squad` (when at the same location with free capacity) or in the controllable reserve at `locationId` without any travel delay.
- Initial equipment and starting cartridges (matched to the character's resolved weapon family via `CampaignCharacterEquipmentMapper`) are issued once on initial recruitment; snapshot restoration never invokes `RecruitCombatantUseCase`.
- At the compatibility boundary, the legacy `recruitCivic` command alias and `civicStatus` eligibility helper route to this contract without defining a second category of recruit.

## Repository

This README describes only the `RecruitCombatant` contract. `RecruitCombatantUseCase` owns `RecruitCombatantRepository`, which exposes `load(request)` and `commit(context, outcome)`. It does not share a repository interface with other personnel use cases; `CampaignRecruitCombatantRepository` in infrastructure operates within the caller's `GameUnitOfWork`.

## Domain objects and related terms

- `RecruitmentService` coordinates eligibility, placement, `ServiceContract` creation, `ForceRoster` admission, and `Treasury` payment.
- `Character`, `ForceRoster`, `Squad`, `ServiceContract`, `Treasury`, `Money`, and `GameTime` enforce personnel and financial invariants.
- `DomainRefusal` and `CampaignRuleRefusal` carry typed refusal codes.
- Related contracts: [GetRecruitmentCandidates](../get-recruitment-candidates/README.md), [RenewServiceContract](../renew-service-contract/README.md), [FormSquad](../form-squad/README.md), and [TalkToCharacter](../../talk-to-character/README.md).
