export const EntryEdge = Object.freeze({ North: 'N', East: 'E', South: 'S', West: 'W' } as const);
export type EntryEdgeValue = (typeof EntryEdge)[keyof typeof EntryEdge];
export type DeploymentPoint = Readonly<{ x: number; y: number }>;
export type DeploymentParticipant = Readonly<{ characterId: string; entryEdge: EntryEdgeValue }>;
export type DeploymentCells = Readonly<Record<EntryEdgeValue, readonly DeploymentPoint[]>>;
export type SectorDeploymentSnapshot = Readonly<{
  participants: readonly DeploymentParticipant[];
  placements: Readonly<Record<string, DeploymentPoint>>;
}>;
export const DeploymentRefusalCode = Object.freeze({
  InvalidPlan: 'invalid-sector-deployment',
  InvalidSelection: 'invalid-deployment-selection',
  InvalidEntryPoint: 'invalid-deployment-entry-point',
  EntryFull: 'deployment-entry-full',
  Incomplete: 'deployment-incomplete',
  EntryBlocked: 'deployment-entry-blocked',
} as const);
export type DeploymentRefusalCodeValue =
  (typeof DeploymentRefusalCode)[keyof typeof DeploymentRefusalCode];
export class DeploymentRefusal extends Error {
  readonly code: DeploymentRefusalCodeValue;
  constructor(code: DeploymentRefusalCodeValue) {
    super(code);
    this.name = 'DeploymentRefusal';
    this.code = code;
  }
}
export const MaximumDeploymentParticipants = 48;
const pointKey = (point: DeploymentPoint): string => `${point.x},${point.y}`;
const samePoint = (first: DeploymentPoint, second: DeploymentPoint): boolean =>
  first.x === second.x && first.y === second.y;

export class SectorDeployment {
  readonly #participants: readonly DeploymentParticipant[];
  readonly #cells: DeploymentCells;
  #placements: Record<string, DeploymentPoint>;

  private constructor(snapshot: SectorDeploymentSnapshot, cells: DeploymentCells) {
    if (
      !snapshot.participants.length ||
      snapshot.participants.length > MaximumDeploymentParticipants ||
      new Set(snapshot.participants.map((participant) => participant.characterId)).size !==
        snapshot.participants.length ||
      snapshot.participants.some(
        (participant) =>
          !participant.characterId || !Object.values(EntryEdge).includes(participant.entryEdge),
      )
    ) {
      throw new DeploymentRefusal(DeploymentRefusalCode.InvalidPlan);
    }
    this.#participants = snapshot.participants.map((participant) => ({ ...participant }));
    this.#cells = structuredClone(cells);
    this.#placements = structuredClone(snapshot.placements);
    const occupied = new Set<string>();
    for (const [characterId, point] of Object.entries(this.#placements)) {
      const participant = this.#participants.find(
        (candidate) => candidate.characterId === characterId,
      );
      if (
        !participant ||
        !Number.isSafeInteger(point.x) ||
        !Number.isSafeInteger(point.y) ||
        !this.#cells[participant.entryEdge].some((cell) => samePoint(cell, point)) ||
        occupied.has(pointKey(point))
      ) {
        throw new DeploymentRefusal(DeploymentRefusalCode.InvalidPlan);
      }
      occupied.add(pointKey(point));
    }
  }

  static restore(snapshot: SectorDeploymentSnapshot, cells: DeploymentCells): SectorDeployment {
    return new SectorDeployment(snapshot, cells);
  }
  get ready(): boolean {
    return this.#participants.every((participant) => this.#placements[participant.characterId]);
  }

  #select(
    characterIds: readonly string[],
  ): readonly [DeploymentParticipant, ...DeploymentParticipant[]] {
    if (
      !characterIds.length ||
      new Set(characterIds).size !== characterIds.length ||
      characterIds.some(
        (id) => !this.#participants.some((participant) => participant.characterId === id),
      )
    ) {
      throw new DeploymentRefusal(DeploymentRefusalCode.InvalidSelection);
    }
    const selected = characterIds.map((id) => {
      const participant = this.#participants.find((candidate) => candidate.characterId === id);
      if (!participant) throw new DeploymentRefusal(DeploymentRefusalCode.InvalidSelection);
      return participant;
    });
    const [first, ...remaining] = selected;
    if (!first) throw new DeploymentRefusal(DeploymentRefusalCode.InvalidSelection);
    return [first, ...remaining];
  }

  clear(characterIds: readonly string[]): void {
    for (const participant of this.#select(characterIds))
      delete this.#placements[participant.characterId];
  }

  place(characterIds: readonly string[], preferredPoint: DeploymentPoint): void {
    const selected = this.#select(characterIds);
    const edge = selected[0].entryEdge;
    if (
      selected.some((participant) => participant.entryEdge !== edge) ||
      !this.#cells[edge].some((point) => samePoint(point, preferredPoint))
    ) {
      throw new DeploymentRefusal(DeploymentRefusalCode.InvalidEntryPoint);
    }
    const next = { ...this.#placements };
    const occupied = new Set(
      Object.entries(next)
        .filter(([id]) => !characterIds.includes(id))
        .map(([, point]) => pointKey(point)),
    );
    for (const participant of selected) {
      const point = this.#nearest(this.#cells[edge], preferredPoint, occupied);
      if (!point) throw new DeploymentRefusal(DeploymentRefusalCode.EntryFull);
      next[participant.characterId] = point;
      occupied.add(pointKey(point));
    }
    this.#placements = next;
  }

  placeNear(characterIds: readonly string[], anchor: DeploymentPoint): void {
    const selected = this.#select(characterIds),
      edge = selected[0].entryEdge;
    const preferred = this.#nearest(this.#cells[edge], anchor, new Set<string>());
    if (!preferred) throw new DeploymentRefusal(DeploymentRefusalCode.EntryFull);
    this.place(characterIds, preferred);
  }

  spread(): void {
    const next: Record<string, DeploymentPoint> = {};
    const occupied = new Set<string>();
    for (const edge of Object.values(EntryEdge)) {
      const participants = this.#participants.filter(
        (participant) => participant.entryEdge === edge,
      );
      const horizontal = edge === EntryEdge.North || edge === EntryEdge.South;
      const cells = [...this.#cells[edge]].sort((first, second) =>
        horizontal ? first.x - second.x : first.y - second.y,
      );
      for (const [index, participant] of participants.entries()) {
        const preferred = cells[Math.floor(((index + 0.5) * cells.length) / participants.length)];
        const point = preferred && this.#nearest(cells, preferred, occupied);
        if (!point) throw new DeploymentRefusal(DeploymentRefusalCode.EntryFull);
        next[participant.characterId] = point;
        occupied.add(pointKey(point));
      }
    }
    this.#placements = next;
  }

  confirm(occupiedPoints: readonly DeploymentPoint[]): Readonly<Record<string, DeploymentPoint>> {
    if (!this.ready) throw new DeploymentRefusal(DeploymentRefusalCode.Incomplete);
    const occupied = new Set(occupiedPoints.map(pointKey));
    const committed: Record<string, DeploymentPoint> = {};
    for (const participant of this.#participants) {
      const placement = this.#placements[participant.characterId];
      if (!placement) throw new DeploymentRefusal(DeploymentRefusalCode.Incomplete);
      const point = this.#nearest(this.#cells[participant.entryEdge], placement, occupied);
      if (!point) throw new DeploymentRefusal(DeploymentRefusalCode.EntryBlocked);
      committed[participant.characterId] = point;
      occupied.add(pointKey(point));
    }
    return structuredClone(committed);
  }

  #nearest(
    cells: readonly DeploymentPoint[],
    preferred: DeploymentPoint,
    occupied: ReadonlySet<string>,
  ): DeploymentPoint | undefined {
    const distance = (point: DeploymentPoint): number =>
      Math.abs(point.x - preferred.x) + Math.abs(point.y - preferred.y);
    const point = cells
      .filter((cell) => !occupied.has(pointKey(cell)))
      .sort(
        (first, second) =>
          distance(first) - distance(second) || first.y - second.y || first.x - second.x,
      )[0];
    return point && { ...point };
  }

  snapshot(): SectorDeploymentSnapshot {
    return {
      participants: this.#participants.map((participant) => ({ ...participant })),
      placements: structuredClone(this.#placements),
    };
  }
}
