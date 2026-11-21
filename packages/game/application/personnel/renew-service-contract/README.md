# RenewServiceContract

## Intention

Extend a serving character's paid `ServiceContract` from the later of its existing expiry or the current `GameTime` and charge `Treasury` once in one transaction.

## Actor and trigger

The player invokes this use case from the personnel or contract management view to extend a serving combatant's temporary contract before or upon expiration.

## Request

`RenewServiceContractRequest` contains:

- `characterId`: the persistent `Character` identifier of the serving combatant.
- `term`: the renewal service term identifier.
- `expectedExpiresAtSeconds`: optional expected current contract expiry in `GameTime` seconds (`number | null`) to guard against stale views.
- `expectedGuaranteeId`: optional expected guarantee receipt identifier to verify contract continuity.

## Response

`RenewServiceContractResponse` contains:

- `characterId`: the renewed `Character` identifier.
- `paidPesos`: the renewal payment charged from `Treasury` in pesos.
- `expiresAtSeconds`: the new `ServiceContract` expiry in `GameTime` seconds.

## Refusals

Expected refusals throw `DomainRefusal` (or `CampaignRuleRefusal` with a typed `DomainRefusalCode`):

- `DomainRefusalCode.InvalidValue`: `characterId` or `term` is empty, `durationSeconds` is not a positive safe integer, or `now` precedes the contract start.
- `DomainRefusalCode.NotServing`: the character is not in `ForceRoster` or has no active `ServiceContract`.
- `DomainRefusalCode.ContractChanged`: `expectedExpiresAtSeconds` or `expectedGuaranteeId` does not match the stored contract.
- `DomainRefusalCode.ServiceTermsUnavailable`: the requested renewal quote is unavailable for the candidate (`CampaignRuleRefusal`).
- `DomainRefusalCode.CharacterUnavailable`: the `Character` is not alive.
- `DomainRefusalCode.PermanentService`: the existing `ServiceContract` has no expiry (`expiresAt === null`), so it cannot be renewed.
- `DomainRefusalCode.InsufficientFunds`: `Treasury` cannot pay the quoted renewal amount.
- `DomainRefusalCode.TransactionClosed`: `load` or `commit` is called on a closed repository transaction or with mismatched context.

UI adapters translate refusal codes into Spanish player-facing messages.

## Invariants

- A refusal leaves `Treasury`, `ServiceContract`, and the guarantee receipt unchanged.
- `ServiceContract.renew` preserves all unexpired service time by adding `durationSeconds` to `Math.max(now.seconds, current.expiresAt.seconds)`.
- The existing guarantee receipt remains attached to the renewed contract without charging a second deposit.
- `ServiceRenewalService` updates the character's `ServiceContract` and deducts payment from `Treasury` within the caller's `GameUnitOfWork`.

## Repository

This README describes only the `RenewServiceContract` contract. `RenewServiceContractUseCase` owns `RenewServiceContractRepository`, which exposes `load(request)` and `commit(context, contract)`. It does not share a repository interface with recruitment or squad formation use cases; `CampaignRenewServiceContractRepository` in infrastructure runs inside the enclosing `GameUnitOfWork`.

## Domain objects and related terms

- `ServiceRenewalService` coordinates contract renewal across `Character`, `ServiceContract`, `Treasury`, `Money`, and `GameTime`.
- `DomainRefusal` and `CampaignRuleRefusal` carry typed refusal codes.
- Related contracts: [RecruitCombatant](../recruit-combatant/README.md) and [GetRecruitmentCandidates](../get-recruitment-candidates/README.md).
