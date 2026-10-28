import { FieldOfView } from './field-of-view.ts';
import type { SightPoint } from './field-of-view.ts';
import { VisibilityPolicy } from './visibility-policy.ts';

export type SightTarget = SightPoint & Readonly<{ departed: boolean }>;
export type SightEnvironment = {
  range(): number;
  lineOfSightClear(): boolean;
  smokeCells(): number;
};

export class VisionObserver {
  readonly #position: SightPoint;
  readonly #available: boolean;
  readonly #fieldOfView: FieldOfView;
  readonly #visibility: VisibilityPolicy;

  constructor(
    position: SightPoint,
    available: boolean,
    fieldOfView: FieldOfView,
    visibility = new VisibilityPolicy(),
  ) {
    this.#position = { ...position };
    this.#available = available;
    this.#fieldOfView = fieldOfView;
    this.#visibility = visibility;
  }

  canObserve(target: SightTarget, environment: SightEnvironment): boolean {
    if (!this.#available || target.departed || !this.#fieldOfView.includes(this.#position, target))
      return false;
    const distance = Math.hypot(this.#position.x - target.x, this.#position.y - target.y);
    if (distance > environment.range() || !environment.lineOfSightClear()) return false;
    return this.#visibility.smokeIsTransparent(environment.smokeCells());
  }
}
