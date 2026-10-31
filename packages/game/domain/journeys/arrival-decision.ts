export const ArrivalDecisionStatus = Object.freeze({
  Pending: 'pending',
  Fight: 'fight',
  Withdrawal: 'withdrawal',
} as const);

export type ArrivalDecisionStatusValue =
  (typeof ArrivalDecisionStatus)[keyof typeof ArrivalDecisionStatus];

export type ArrivalDecisionSnapshot = Readonly<{
  id: string;
  sectorId: string;
  arrivedAtSeconds: number;
  status: ArrivalDecisionStatusValue;
}>;

export const JourneyRefusalCode = Object.freeze({
  ArrivalDecisionAlreadyResolved: 'arrival-decision-already-resolved',
  ArrivalDecisionMismatch: 'arrival-decision-mismatch',
  ArrivalDecisionNotPending: 'arrival-decision-not-pending',
  HostileRedirectionOutsideCurrentSegment: 'hostile-redirection-outside-current-segment',
  InvalidArrivalDecision: 'invalid-arrival-decision',
  InvalidJourney: 'invalid-journey',
  InvalidJourneyArrival: 'invalid-journey-arrival',
  InvalidJourneyDecision: 'invalid-journey-decision',
  InvalidJourneyDuration: 'invalid-journey-duration',
  InvalidJourneyRedirection: 'invalid-journey-redirection',
  InvalidJourneyReturnRoute: 'invalid-journey-return-route',
  InvalidJourneyTime: 'invalid-journey-time',
  InvalidNextJourneyLeg: 'invalid-next-journey-leg',
  JourneyCannotPauseBetweenSectors: 'journey-cannot-pause-between-sectors',
  JourneyCannotReverse: 'journey-cannot-reverse',
  JourneyDestinationNotFound: 'journey-destination-not-found',
  JourneyLegNotComplete: 'journey-leg-not-complete',
  JourneyLegNotStarting: 'journey-leg-not-starting',
  JourneyNotFound: 'journey-not-found',
  JourneyNotPaused: 'journey-not-paused',
  JourneyNotTravelling: 'journey-not-travelling',
  JourneyRevisionConflict: 'journey-revision-conflict',
  JourneyRouteUnavailable: 'journey-route-unavailable',
  JourneyTimePrecedesProgress: 'journey-time-precedes-progress',
  RedirectionMustStartAtCurrentSegment: 'redirection-must-start-at-current-segment',
  TooManyJourneyWaypoints: 'too-many-journey-waypoints',
} as const);

export type JourneyRefusalCodeValue = (typeof JourneyRefusalCode)[keyof typeof JourneyRefusalCode];

export class JourneyRefusal extends Error {
  readonly code: JourneyRefusalCodeValue;

  constructor(code: JourneyRefusalCodeValue) {
    super(code);
    this.name = 'JourneyRefusal';
    this.code = code;
  }
}

export class ArrivalDecision {
  readonly #id: string;
  readonly #sectorId: string;
  readonly #arrivedAtSeconds: number;
  #status: ArrivalDecisionStatusValue;

  private constructor(snapshot: ArrivalDecisionSnapshot) {
    if (
      !snapshot.id ||
      !snapshot.sectorId ||
      !Number.isSafeInteger(snapshot.arrivedAtSeconds) ||
      snapshot.arrivedAtSeconds < 0 ||
      !Object.values(ArrivalDecisionStatus).includes(snapshot.status)
    ) {
      throw new JourneyRefusal(JourneyRefusalCode.InvalidArrivalDecision);
    }
    this.#id = snapshot.id;
    this.#sectorId = snapshot.sectorId;
    this.#arrivedAtSeconds = snapshot.arrivedAtSeconds;
    this.#status = snapshot.status;
  }

  static create(id: string, sectorId: string, arrivedAtSeconds: number): ArrivalDecision {
    return new ArrivalDecision({
      id,
      sectorId,
      arrivedAtSeconds,
      status: ArrivalDecisionStatus.Pending,
    });
  }

  static restore(snapshot: ArrivalDecisionSnapshot): ArrivalDecision {
    return new ArrivalDecision(snapshot);
  }

  get id(): string {
    return this.#id;
  }
  get sectorId(): string {
    return this.#sectorId;
  }
  get pending(): boolean {
    return this.#status === ArrivalDecisionStatus.Pending;
  }

  chooseFight(expectedId: string): void {
    this.#resolve(expectedId, ArrivalDecisionStatus.Fight);
  }

  chooseWithdrawal(expectedId: string): void {
    this.#resolve(expectedId, ArrivalDecisionStatus.Withdrawal);
  }

  #resolve(expectedId: string, resolution: ArrivalDecisionStatusValue): void {
    if (expectedId !== this.#id) {
      throw new JourneyRefusal(JourneyRefusalCode.ArrivalDecisionMismatch);
    }
    if (!this.pending) {
      throw new JourneyRefusal(JourneyRefusalCode.ArrivalDecisionAlreadyResolved);
    }
    this.#status = resolution;
  }

  snapshot(): ArrivalDecisionSnapshot {
    return {
      id: this.#id,
      sectorId: this.#sectorId,
      arrivedAtSeconds: this.#arrivedAtSeconds,
      status: this.#status,
    };
  }
}
