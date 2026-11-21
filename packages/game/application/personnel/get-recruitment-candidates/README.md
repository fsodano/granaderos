# GetRecruitmentCandidates

## Intention

Read the filtered and ordered `RecruitmentCatalogue` of `RecruitmentCandidate` records without changing `GameTime`, `Treasury`, `ServiceContract` state, or game revision.

## Actor and trigger

The player or UI adapter invokes this read-only use case when opening, filtering, searching, or sorting the recruitment catalogue.

## Request

`GetRecruitmentCandidatesRequest` (`RecruitmentCriteria`) contains optional filter and sort criteria:

- `query`: free-text filter matched case- and accent-insensitively (`es` locale) against candidate name, nickname, and role.
- `specialty`: `'all'` (default) or a `RecruitmentSpecialty` key (`'marksman'`, `'medic'`, `'mechanic'`, `'artillery'`, `'leader'`, `'scout'`, or `'rider'`).
- `availability`: `'all'` (default) or a `RecruitmentAvailability` status (`'available'`, `'unavailable'`, `'pending'`, `'hired'`, `'fallen'`, or `'captured'`).
- `sort`: `RecruitmentOrder` key (`'name'` default, `'price'`, `'marksmanship'`, or `'medical'`).

## Response

`GetRecruitmentCandidatesResponse` contains:

- `characterIds`: ordered array of canonical `Character` identifiers matching the request criteria.

## Refusals

- `GetRecruitmentCandidatesUseCase` does not throw domain refusals for empty matches or unknown filter keys; unmatched queries return an empty `characterIds` array, and unrecognised specialty or sort strings fall back to unfiltered specialty matching and Spanish alphabetical name ordering with `characterId` tie-breaking.

## Invariants

- The query is read-only: it never advances `WorldTimeline`, deducts `Treasury` funds, creates a `ServiceContract`, or advances `gameRevision`.
- Every `RecruitmentCandidate` derives its ratings and traits from the character's restored `CharacterAbilities` value object (via `CanonicalPersonnelMapper`); the catalogue never maintains a separate skill or trait copy.
- Rating-based specialties (`marksman`, `medic`, `mechanic`, `artillery`, `leader`) require a rating of at least `RecruitmentExpertiseThreshold` (70) on the corresponding `CharacterRating`; `scout` checks `CharacterTrait.GuerrillaTactician`; `rider` checks `CharacterTrait.ExpertRider` or `CharacterTrait.CavalryCommander`.
- Candidate availability reflects current character life status, `ForceRoster` membership, legacy prepaid claims (`pending`), capture state, service quote availability, and campaign eligibility. Because world state can change before hiring, [RecruitCombatant](../recruit-combatant/README.md) re-evaluates eligibility and terms inside its own transaction.

## Repository

This README describes only the `GetRecruitmentCandidates` contract. `GetRecruitmentCandidatesUseCase` owns `GetRecruitmentCandidatesRepository`, which exposes only `loadCatalogue(): RecruitmentCatalogue` and has no commit method. It does not share a repository interface with mutating personnel use cases.

## Domain objects and related terms

- `RecruitmentCatalogue` filters and orders `RecruitmentCandidate` instances.
- `RecruitmentCandidate` evaluates text queries and specialty thresholds against `CharacterAbilities`, `CharacterRating`, and `CharacterTrait`.
- Related contracts: [RecruitCombatant](../recruit-combatant/README.md) and [RenewServiceContract](../renew-service-contract/README.md).
