export type WorldEvent = Readonly<{
  id: string;
  kind: string;
  subjectId: string;
  atSecond: number;
}>;

export type WorldTimelineSnapshot = Readonly<{
  currentSecond: number;
  pendingEvents: readonly WorldEvent[];
  completedEventIds: readonly string[];
}>;

export function requireGameSecond(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('Game time must be a non-negative safe integer.');
  }
}

function compareEvents(left: WorldEvent, right: WorldEvent): number {
  return left.atSecond - right.atSecond || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

export class WorldTimeline {
  #currentSecond: number;
  #pendingEvents = new Map<string, WorldEvent>();
  #completedEventIds: Set<string>;

  constructor(snapshot: WorldTimelineSnapshot) {
    if (
      !snapshot ||
      !Array.isArray(snapshot.pendingEvents) ||
      !Array.isArray(snapshot.completedEventIds)
    ) {
      throw new Error('A world timeline requires pending events and completion receipts.');
    }
    requireGameSecond(snapshot.currentSecond);
    this.#currentSecond = snapshot.currentSecond;
    this.#completedEventIds = new Set(snapshot.completedEventIds);
    if (this.#completedEventIds.size !== snapshot.completedEventIds.length) {
      throw new Error('A world event cannot complete twice.');
    }
    for (const id of this.#completedEventIds) {
      if (typeof id !== 'string' || !id.length) throw new Error('A world event needs an identity.');
    }
    for (const event of snapshot.pendingEvents) {
      if (this.#pendingEvents.has(event.id))
        throw new Error('A scheduled world event cannot appear twice.');
      this.schedule(event);
    }
  }

  static startAt(currentSecond: number): WorldTimeline {
    return new WorldTimeline({ currentSecond, pendingEvents: [], completedEventIds: [] });
  }

  get currentSecond(): number {
    return this.#currentSecond;
  }

  schedule(event: WorldEvent): void {
    requireGameSecond(event.atSecond);
    if (
      ![event.id, event.kind, event.subjectId].every(
        (value) => typeof value === 'string' && value.length > 0,
      )
    )
      throw new Error('A world event needs an identity and subject.');
    if (event.atSecond < this.#currentSecond)
      throw new Error('A world event cannot be scheduled before the accepted time.');
    if (this.#completedEventIds.has(event.id))
      throw new Error('A completed world event cannot be scheduled again.');
    const existing = this.#pendingEvents.get(event.id);
    if (existing) {
      if (
        existing.atSecond !== event.atSecond ||
        existing.kind !== event.kind ||
        existing.subjectId !== event.subjectId
      ) {
        throw new Error('A world event identity cannot refer to different consequences.');
      }
      return;
    }
    this.#pendingEvents.set(event.id, Object.freeze({ ...event }));
  }

  advanceTo(targetSecond: number, applyEvent: (event: WorldEvent) => 'continue' | 'pause'): void {
    requireGameSecond(targetSecond);
    if (targetSecond < this.#currentSecond) throw new Error('World time cannot move backwards.');
    while (true) {
      const next = [...this.#pendingEvents.values()].sort(compareEvents)[0];
      if (!next || next.atSecond > targetSecond) break;
      const decision = applyEvent(next);
      if (decision !== 'continue' && decision !== 'pause')
        throw new Error('A world event must return a progression decision.');
      this.#currentSecond = next.atSecond;
      this.#pendingEvents.delete(next.id);
      this.#completedEventIds.add(next.id);
      if (decision === 'pause') return;
    }
    this.#currentSecond = targetSecond;
  }

  toSnapshot(): WorldTimelineSnapshot {
    return {
      currentSecond: this.#currentSecond,
      pendingEvents: [...this.#pendingEvents.values()]
        .sort(compareEvents)
        .map((event) => ({ ...event })),
      completedEventIds: [...this.#completedEventIds].sort(),
    };
  }
}
