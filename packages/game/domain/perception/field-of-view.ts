export type SightPoint = Readonly<{ x: number; y: number }>;

const CompassDirections = 8;
const RadiansPerDirection = Math.PI / 4;
const AlignmentTolerance = 1e-12;

export class FieldOfView {
  readonly #facing: number;
  readonly #peripheralRange: number;
  readonly #halfArc: number;

  constructor(facing: number, peripheralRange = 2, halfArc = 2) {
    if (
      !Number.isInteger(facing) ||
      facing < 0 ||
      facing >= CompassDirections ||
      !Number.isFinite(peripheralRange) ||
      peripheralRange < 0 ||
      !Number.isFinite(halfArc) ||
      halfArc < 0 ||
      halfArc > CompassDirections / 2
    ) {
      throw new RangeError('The field of view is invalid.');
    }
    this.#facing = facing;
    this.#peripheralRange = peripheralRange;
    this.#halfArc = halfArc;
  }

  includes(observer: SightPoint, target: SightPoint): boolean {
    if (![observer.x, observer.y, target.x, target.y].every(Number.isFinite)) {
      throw new RangeError('Sight coordinates must be finite.');
    }
    const horizontal = target.x - observer.x;
    const vertical = target.y - observer.y;
    const distance = Math.hypot(horizontal, vertical);
    if (distance <= this.#peripheralRange) {
      return true;
    }
    const angle = this.#facing * RadiansPerDirection;
    const alignment = (horizontal * Math.sin(angle) - vertical * Math.cos(angle)) / distance;
    return alignment + AlignmentTolerance >= Math.cos(this.#halfArc * RadiansPerDirection);
  }
}
