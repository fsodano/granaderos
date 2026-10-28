export const DomainRefusalCode = Object.freeze({
  ServiceTermsUnavailable: 'service-terms-unavailable',
  ConversationUnavailable: 'conversation-unavailable',
  SavedGameUnavailable: 'saved-game-unavailable',
  InvalidGameSeed: 'invalid-game-seed',
  InvalidSquadName: 'invalid-squad-name',
  InvalidSquadMembers: 'invalid-squad-members',
  SquadUnavailable: 'squad-unavailable',
  SquadLocationMismatch: 'squad-location-mismatch',
  TooManySquads: 'too-many-squads',
  DuplicateSectorParticipation: 'duplicate-sector-participation',
  NotServing: 'character-not-serving',
  PermanentService: 'permanent-service',
  ContractChanged: 'contract-changed',
  InvalidValue: 'invalid-domain-value',
  InsufficientFunds: 'insufficient-funds',
  CharacterUnavailable: 'character-unavailable',
  AlreadyServing: 'already-serving',
  InvalidPlacement: 'invalid-recruitment-placement',
  CandidateIneligible: 'candidate-ineligible',
  RevisionConflict: 'revision-conflict',
  TransactionClosed: 'transaction-closed',
} as const);

export type DomainRefusalCodeValue = (typeof DomainRefusalCode)[keyof typeof DomainRefusalCode];

export class DomainRefusal extends Error {
  readonly code: DomainRefusalCodeValue;

  constructor(code: DomainRefusalCodeValue) {
    super(code);
    this.name = 'DomainRefusal';
    this.code = code;
  }
}
