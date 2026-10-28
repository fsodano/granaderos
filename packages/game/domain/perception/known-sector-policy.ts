export type ObservationFacts = Readonly<{
  friendly: boolean;
  visible: boolean;
  interiorKnown: boolean;
}>;

export class KnownSectorPolicy {
  admitsCharacter(facts: ObservationFacts): boolean {
    return facts.friendly || (facts.visible && facts.interiorKnown);
  }

  admitsProp(visible: boolean, interiorKnown: boolean): boolean {
    return visible && interiorKnown;
  }

  retainsReflectingCover(stoneObstacle: boolean, visible: boolean): boolean {
    return !stoneObstacle || visible;
  }
}
