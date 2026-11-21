# TalkToCharacter

## Intention

Resolve a controlled participant's conversation with a present character in the active `SectorSession` and project all accepted dialogue, quest, recruitment, and participant changes into both the campaign and the `SectorSession` in one transaction.

## Actor and trigger

The player invokes this use case from the active sector view when initiating or advancing a dialogue, local recruitment offer, quest resolution, or quest withdrawal with a resident.

## Request

`TalkToCharacterRequest` contains:

- `characterId`: the persistent `Character` identifier of the resident being addressed.
- `speakerId`: the persistent `Character` identifier of the controlled speaking participant.
- `approach`: the conversation approach identifier.
- `expectedRevision`: optional expected `gameRevision` to detect stale requests.
- `serviceTerm`: optional service term identifier when offering recruitment during conversation.
- `dialogueNodeId` and `dialogueChoiceId`: optional paired identifiers selecting a dialogue node and choice (must be supplied together or both omitted).
- `questResolution`: optional quest reward choice (`'cash'` or `'recruit'`).
- `questWithdrawal`: optional `{ questId: string; beneficiaryId?: string; deliveredCount: number }` payload.

## Response

`TalkToCharacterResponse<TCampaign, TSectorSession>` contains:

- `campaign`: the updated campaign snapshot (`TCampaign`).
- `sectorSession`: the synchronized active sector session snapshot (`TSectorSession`).

## Refusals

Expected refusals throw `DomainRefusal` (or its infrastructure subclass `CampaignRuleRefusal` with a typed `DomainRefusalCode`):

- `DomainRefusalCode.InvalidValue`: `characterId`, `speakerId`, or `approach` is empty, or only one of `dialogueNodeId` and `dialogueChoiceId` is provided.
- `DomainRefusalCode.ConversationUnavailable`: no active campaign or `SectorSession` is open, or the conversation rule refuses the interaction (`CampaignRuleRefusal`).
- `DomainRefusalCode.RevisionConflict`: `expectedRevision` does not match the source campaign's `gameRevision` on `resolve` or `commit`.
- `DomainRefusalCode.TransactionClosed`: `resolve`, `projectParticipants`, or `commit` is called out of order or after the repository transaction has closed.
- Local recruitment during conversation also enforces `RecruitmentService` refusals (`CandidateIneligible`, `ServiceTermsUnavailable`, `InsufficientFunds`, `AlreadyServing`, `CharacterUnavailable`).

UI adapters translate refusal codes into Spanish player-facing messages.

## Invariants

- `TalkToCharacterUseCase` executes `resolve(request)`, `projectParticipants()`, and `commit()` sequentially in a single transaction; any failure closes the repository and publishes neither `campaign` nor `sectorSession`.
- When a conversation results in local recruitment (`RecruitmentEquipmentSource.ResidentInventory`), `ConversationParticipantProjection` preserves the character's canonical identity, exact local coordinates, tactical level, facing, posture, `Health`, and carried inventory: it removes the resident record and admits one controlled `SectorParticipant` in the active `SectorSession`.
- Quest escort, withdrawal, and dialogue-triggered movement project through the same `ConversationParticipantProjection` in both live gameplay and `campaign-editor` playtests.
- At the compatibility boundary inside `CampaignTalkToCharacterRepository`, canonical request fields (`characterId`, `speakerId`, `questResolution: 'recruit'`) map to legacy internal command keys (`npcId`, `unitId`, `'civic'`) without leaking those aliases into the application contract.

## Repository

This README describes only the `TalkToCharacter` contract. `TalkToCharacterUseCase` owns `TalkToCharacterRepository<TCampaign, TSectorSession>`, which exposes `resolve(request)`, `projectParticipants()`, and `commit()`. It does not share a repository interface with [RecruitCombatant](../personnel/recruit-combatant/README.md) or [ExecuteSectorOrder](../sector-sessions/execute-sector-order/README.md).

## Domain objects and related terms

- `Character`, `SectorSession`, `SectorParticipant`, `RecruitmentService`, and `ServiceContract` govern identity, local recruitment, and participant projection.
- `DomainRefusal` and `CampaignRuleRefusal` carry typed refusal codes.
- Related contracts: [RecruitCombatant](../personnel/recruit-combatant/README.md) and [ExecuteSectorOrder](../sector-sessions/execute-sector-order/README.md).
