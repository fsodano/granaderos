import {
  ArrivalDecision,
  ArrivalDecisionStatus,
  JourneyRefusal,
  JourneyRefusalCode,
} from './arrival-decision.ts';
import type { ArrivalDecisionSnapshot } from './arrival-decision.ts';

export const SecondsPerTravelHour = 3600;
export const JourneyLimits = Object.freeze({ MaximumRouteLocations: 65, MaximumWaypoints: 8 });
export const JourneyPurpose = Object.freeze({
  Travel: 'travel',
  HostileApproach: 'hostile-approach',
  Withdrawal: 'withdrawal',
} as const);
export const JourneyStatus = Object.freeze({
  Travelling: 'travelling',
  Paused: 'paused',
  AwaitingArrivalDecision: 'awaiting-arrival-decision',
  Completed: 'completed',
} as const);
export const JourneyDirection = Object.freeze({
  Forward: 'forward',
  Backward: 'backward',
} as const);
export const JourneyMode = Object.freeze({
  March: 'march',
  Horse: 'horse',
  Posta: 'posta',
  Flotilla: 'flotilla',
  Carts: 'carts',
} as const);
export type JourneyPurposeValue = (typeof JourneyPurpose)[keyof typeof JourneyPurpose];
export type JourneyStatusValue = (typeof JourneyStatus)[keyof typeof JourneyStatus];
export type JourneyDirectionValue = (typeof JourneyDirection)[keyof typeof JourneyDirection];
export type JourneyModeValue = (typeof JourneyMode)[keyof typeof JourneyMode];

export type JourneySnapshot = Readonly<{
  id: string;
  route: readonly string[];
  returnRoute?: readonly string[];
  mode: JourneyModeValue;
  purpose: JourneyPurposeValue;
  status: JourneyStatusValue;
  startedAtSeconds: number;
  legDurationSeconds: number;
  positionSeconds: number;
  direction: JourneyDirectionValue;
  travelledSeconds: number;
  workSeconds: number;
  legPaid: boolean;
  arrivalSequence: number;
  arrivalDecision?: ArrivalDecisionSnapshot;
  pauseReason?: string;
}>;

export type RedirectJourneyPlan = Readonly<{
  through: string;
  route: readonly string[];
  purpose: JourneyPurposeValue;
}>;

export class Journey {
  readonly #id: string;
  readonly #mode: JourneyModeValue;
  readonly #startedAtSeconds: number;
  #route: [string, string, ...string[]];
  #returnRoute: string[] | undefined;
  #purpose: JourneyPurposeValue;
  #status: JourneyStatusValue;
  #legDurationSeconds: number;
  #positionSeconds: number;
  #direction: JourneyDirectionValue;
  #travelledSeconds: number;
  #workSeconds: number;
  #legPaid: boolean;
  #arrivalSequence: number;
  #arrivalDecision: ArrivalDecision | undefined;
  #pauseReason: string | undefined;

  private constructor(snapshot: JourneySnapshot) {
    this.#id = snapshot.id;
    this.#route = Journey.#routeWithCurrentSegment(snapshot.route);
    this.#returnRoute = snapshot.returnRoute ? [...snapshot.returnRoute] : undefined;
    this.#mode = snapshot.mode;
    this.#purpose = snapshot.purpose;
    this.#status = snapshot.status;
    this.#startedAtSeconds = snapshot.startedAtSeconds;
    this.#legDurationSeconds = snapshot.legDurationSeconds;
    this.#positionSeconds = snapshot.positionSeconds;
    this.#direction = snapshot.direction;
    this.#travelledSeconds = snapshot.travelledSeconds;
    this.#workSeconds = snapshot.workSeconds;
    this.#legPaid = snapshot.legPaid;
    this.#arrivalSequence = snapshot.arrivalSequence;
    this.#arrivalDecision = snapshot.arrivalDecision
      ? ArrivalDecision.restore(snapshot.arrivalDecision)
      : undefined;
    this.#pauseReason = snapshot.pauseReason;
    this.#validate();
  }

  static begin(
    options: Pick<
      JourneySnapshot,
      'id' | 'route' | 'mode' | 'purpose' | 'startedAtSeconds' | 'legDurationSeconds'
    >,
  ): Journey {
    return new Journey({
      ...options,
      status: JourneyStatus.Travelling,
      positionSeconds: 0,
      direction: JourneyDirection.Forward,
      travelledSeconds: 0,
      workSeconds: 0,
      legPaid: false,
      arrivalSequence: 0,
    });
  }

  static restore(snapshot: JourneySnapshot): Journey {
    return new Journey(snapshot);
  }

  get id(): string {
    return this.#id;
  }
  get purpose(): JourneyPurposeValue {
    return this.#purpose;
  }
  get status(): JourneyStatusValue {
    return this.#status;
  }
  get positionSeconds(): number {
    return this.#positionSeconds;
  }
  get travelledSeconds(): number {
    return this.#travelledSeconds;
  }
  get workSeconds(): number {
    return this.#workSeconds;
  }
  get travelling(): boolean {
    return this.#status === JourneyStatus.Travelling;
  }
  get awaitingArrivalDecision(): boolean {
    return this.#status === JourneyStatus.AwaitingArrivalDecision;
  }
  get backwards(): boolean {
    return this.#direction === JourneyDirection.Backward;
  }
  get legPaid(): boolean {
    return this.#legPaid;
  }
  get origin(): string {
    return this.#route[0];
  }
  get nextSector(): string {
    return this.backwards ? this.#route[0] : this.#route[1];
  }
  get destination(): string {
    return this.backwards
      ? (this.#returnRoute?.at(-1) ?? this.origin)
      : (this.#route.at(-1) ?? this.nextSector);
  }
  get remainingLegSeconds(): number {
    return this.backwards
      ? this.#positionSeconds
      : this.#legDurationSeconds - this.#positionSeconds;
  }
  get arrivalDecision(): ArrivalDecisionSnapshot | undefined {
    return this.#arrivalDecision?.snapshot();
  }

  markLegPaid(): void {
    if (!this.travelling || this.backwards || this.#positionSeconds !== 0)
      throw new JourneyRefusal(JourneyRefusalCode.JourneyLegNotStarting);
    this.#legPaid = true;
  }

  pause(reason: string): void {
    if (!this.travelling) throw new JourneyRefusal(JourneyRefusalCode.JourneyNotTravelling);
    if (this.#positionSeconds !== 0)
      throw new JourneyRefusal(JourneyRefusalCode.JourneyCannotPauseBetweenSectors);
    this.#status = JourneyStatus.Paused;
    this.#pauseReason = reason;
  }

  resume(): void {
    if (this.#status !== JourneyStatus.Paused)
      throw new JourneyRefusal(JourneyRefusalCode.JourneyNotPaused);
    this.#status = JourneyStatus.Travelling;
    this.#pauseReason = undefined;
  }

  stopAtNextSector(): void {
    if (!this.travelling) throw new JourneyRefusal(JourneyRefusalCode.JourneyNotTravelling);
    if (!this.backwards) this.#route = [this.#route[0], this.#route[1]];
    this.#returnRoute = undefined;
  }

  returnToOrigin(): void {
    if (!this.travelling && this.#status !== JourneyStatus.Paused)
      throw new JourneyRefusal(JourneyRefusalCode.JourneyNotTravelling);
    this.#direction = JourneyDirection.Backward;
    this.#returnRoute = undefined;
    this.#status = JourneyStatus.Travelling;
    this.#pauseReason = undefined;
    if (this.#purpose === JourneyPurpose.HostileApproach) this.#purpose = JourneyPurpose.Withdrawal;
  }

  reverseForBlockedRoute(reason: string): void {
    if (!this.travelling || this.#positionSeconds === 0)
      throw new JourneyRefusal(JourneyRefusalCode.JourneyCannotReverse);
    this.#direction = JourneyDirection.Backward;
    this.#returnRoute = undefined;
    this.#pauseReason = reason;
  }

  advance(
    requestedSeconds: number,
    acceptedAtSeconds: number,
  ): { acceptedSeconds: number; completedWorkHours: number; reachedBoundary: boolean } {
    if (
      !Number.isSafeInteger(requestedSeconds) ||
      requestedSeconds < 1 ||
      !Number.isSafeInteger(acceptedAtSeconds) ||
      acceptedAtSeconds < this.#startedAtSeconds
    ) {
      throw new JourneyRefusal(JourneyRefusalCode.InvalidJourneyDuration);
    }
    if (!this.travelling) throw new JourneyRefusal(JourneyRefusalCode.JourneyNotTravelling);
    const acceptedSeconds = Math.min(requestedSeconds, this.remainingLegSeconds);
    const reachedAtSeconds = acceptedAtSeconds - (requestedSeconds - acceptedSeconds);
    if (reachedAtSeconds - this.#startedAtSeconds < this.#travelledSeconds + acceptedSeconds) {
      throw new JourneyRefusal(JourneyRefusalCode.JourneyTimePrecedesProgress);
    }
    const accumulatedWork = this.#workSeconds + acceptedSeconds;
    const completedWorkHours = Math.floor(accumulatedWork / SecondsPerTravelHour);
    this.#workSeconds = accumulatedWork % SecondsPerTravelHour;
    this.#travelledSeconds += acceptedSeconds;
    this.#positionSeconds += this.backwards ? -acceptedSeconds : acceptedSeconds;
    const reachedBoundary = this.remainingLegSeconds === 0;
    if (reachedBoundary && !this.backwards && this.#purpose === JourneyPurpose.HostileApproach) {
      this.#requireArrivalDecision(reachedAtSeconds);
    }
    return { acceptedSeconds, completedWorkHours, reachedBoundary };
  }

  chooseFight(decisionId: string): void {
    this.#requirePendingDecision().chooseFight(decisionId);
    this.#status = JourneyStatus.Completed;
    this.#pauseReason = undefined;
  }

  chooseWithdrawal(decisionId: string): void {
    this.#requirePendingDecision().chooseWithdrawal(decisionId);
    this.#purpose = JourneyPurpose.Withdrawal;
    this.#direction = JourneyDirection.Backward;
    this.#status = JourneyStatus.Travelling;
    this.#returnRoute = undefined;
    this.#pauseReason = undefined;
  }

  redirect(plan: RedirectJourneyPlan, nowSeconds: number): void {
    if (!this.travelling) throw new JourneyRefusal(JourneyRefusalCode.JourneyNotTravelling);
    if (!Number.isSafeInteger(nowSeconds) || nowSeconds < this.#startedAtSeconds)
      throw new JourneyRefusal(JourneyRefusalCode.InvalidJourneyTime);
    if (
      !plan.route.length ||
      plan.route[0] !== plan.through ||
      !Object.values(JourneyPurpose).includes(plan.purpose)
    ) {
      throw new JourneyRefusal(JourneyRefusalCode.InvalidJourneyRedirection);
    }
    if (plan.through === this.#route[0]) {
      this.#direction = JourneyDirection.Backward;
      this.#returnRoute = [...plan.route];
    } else if (plan.through === this.#route[1]) {
      this.#direction = JourneyDirection.Forward;
      this.#route = Journey.#routeWithCurrentSegment([this.origin, ...plan.route]);
      this.#returnRoute = undefined;
    } else {
      throw new JourneyRefusal(JourneyRefusalCode.RedirectionMustStartAtCurrentSegment);
    }
    this.#purpose = plan.purpose;
    this.#pauseReason = undefined;
    if (
      !this.backwards &&
      this.remainingLegSeconds === 0 &&
      this.#purpose === JourneyPurpose.HostileApproach
    ) {
      this.#requireArrivalDecision(nowSeconds);
    }
  }

  finishLeg(nextLegDurationSeconds?: number): { from: string; to: string; complete: boolean } {
    if (!this.travelling || this.remainingLegSeconds !== 0)
      throw new JourneyRefusal(JourneyRefusalCode.JourneyLegNotComplete);
    const from = this.origin;
    const to = this.nextSector;
    const nextRoute = this.backwards ? this.#returnRoute : this.#route.slice(1);
    if (!nextRoute || nextRoute.length < 2) {
      this.#status = JourneyStatus.Completed;
      return { from, to, complete: true };
    }
    if (
      nextLegDurationSeconds === undefined ||
      !Number.isSafeInteger(nextLegDurationSeconds) ||
      nextLegDurationSeconds < 1
    )
      throw new JourneyRefusal(JourneyRefusalCode.InvalidNextJourneyLeg);
    this.#route = Journey.#routeWithCurrentSegment(nextRoute);
    this.#returnRoute = undefined;
    this.#positionSeconds = 0;
    this.#legDurationSeconds = nextLegDurationSeconds;
    this.#direction = JourneyDirection.Forward;
    this.#legPaid = false;
    return { from, to, complete: false };
  }

  static #routeWithCurrentSegment(route: readonly string[]): [string, string, ...string[]] {
    const [origin, destination, ...remaining] = route;
    if (!origin || !destination) throw new JourneyRefusal(JourneyRefusalCode.InvalidJourney);
    return [origin, destination, ...remaining];
  }

  #requirePendingDecision(): ArrivalDecision {
    if (!this.awaitingArrivalDecision || !this.#arrivalDecision?.pending)
      throw new JourneyRefusal(JourneyRefusalCode.ArrivalDecisionNotPending);
    return this.#arrivalDecision;
  }

  #requireArrivalDecision(nowSeconds: number): void {
    this.#arrivalSequence++;
    this.#arrivalDecision = ArrivalDecision.create(
      `${this.#id}:arrival:${this.#arrivalSequence}`,
      this.#route[1],
      nowSeconds,
    );
    this.#status = JourneyStatus.AwaitingArrivalDecision;
    this.#pauseReason = undefined;
  }

  #validate(): void {
    const natural = (value: number) => Number.isSafeInteger(value) && value >= 0;
    if (
      !this.#id ||
      this.#route.length < 2 ||
      this.#route.length > JourneyLimits.MaximumRouteLocations ||
      this.#route.some((id) => !id) ||
      !Object.values(JourneyMode).includes(this.#mode) ||
      !Object.values(JourneyPurpose).includes(this.#purpose) ||
      !Object.values(JourneyStatus).includes(this.#status) ||
      !Object.values(JourneyDirection).includes(this.#direction) ||
      !natural(this.#startedAtSeconds) ||
      !natural(this.#positionSeconds) ||
      !natural(this.#travelledSeconds) ||
      !natural(this.#legDurationSeconds) ||
      this.#legDurationSeconds === 0 ||
      this.#positionSeconds > this.#legDurationSeconds ||
      !natural(this.#workSeconds) ||
      this.#workSeconds >= SecondsPerTravelHour ||
      !natural(this.#arrivalSequence) ||
      typeof this.#legPaid !== 'boolean' ||
      this.#travelledSeconds < this.#positionSeconds
    ) {
      throw new JourneyRefusal(JourneyRefusalCode.InvalidJourney);
    }
    if (
      this.#returnRoute &&
      (!this.backwards || this.#returnRoute[0] !== this.origin || this.#returnRoute.length > 65)
    ) {
      throw new JourneyRefusal(JourneyRefusalCode.InvalidJourneyReturnRoute);
    }
    if (
      this.awaitingArrivalDecision &&
      (this.backwards ||
        this.#positionSeconds !== this.#legDurationSeconds ||
        this.#purpose !== JourneyPurpose.HostileApproach ||
        !this.#arrivalDecision?.pending)
    ) {
      throw new JourneyRefusal(JourneyRefusalCode.InvalidJourneyArrival);
    }
    if (this.#arrivalDecision) {
      const decision = this.#arrivalDecision.snapshot();
      if (
        decision.id !== `${this.#id}:arrival:${this.#arrivalSequence}` ||
        decision.arrivedAtSeconds < this.#startedAtSeconds ||
        (decision.sectorId !== this.#route[1] &&
          decision.status === ArrivalDecisionStatus.Pending) ||
        (decision.status === ArrivalDecisionStatus.Pending && !this.awaitingArrivalDecision)
      ) {
        throw new JourneyRefusal(JourneyRefusalCode.InvalidJourneyDecision);
      }
    }
  }

  snapshot(): JourneySnapshot {
    return {
      id: this.#id,
      route: [...this.#route],
      ...(this.#returnRoute ? { returnRoute: [...this.#returnRoute] } : {}),
      mode: this.#mode,
      purpose: this.#purpose,
      status: this.#status,
      startedAtSeconds: this.#startedAtSeconds,
      legDurationSeconds: this.#legDurationSeconds,
      positionSeconds: this.#positionSeconds,
      direction: this.#direction,
      travelledSeconds: this.#travelledSeconds,
      workSeconds: this.#workSeconds,
      legPaid: this.#legPaid,
      arrivalSequence: this.#arrivalSequence,
      ...(this.#arrivalDecision ? { arrivalDecision: this.#arrivalDecision.snapshot() } : {}),
      ...(this.#pauseReason ? { pauseReason: this.#pauseReason } : {}),
    };
  }
}
