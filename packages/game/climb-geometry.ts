export type ClimbSide = 'l' | 'r';
export type ClimbPoint = readonly [number, number, number];
export interface ClimbGeometry {
  height: number;
  span: number;
  baseSpan?: number;
  edgeSpan: number;
  ladderSpan: number;
  steps: number;
}
function point(value: readonly number[]): ClimbPoint {
  const [x, y, z] = value;
  if (x === undefined || y === undefined || z === undefined || ![x, y, z].every(Number.isFinite)) {
    throw new Error('A climb point must have three finite coordinates.');
  }
  return [x, y, z];
}
// One physical ladder serves world geometry, native authoring and playback.
// Saved link cells remain the ground and roof destinations.
export const LADDER_RUNG_DISTANCE = 0.29;
export const LADDER_HALF_WIDTH = 0.23;
export const LADDER_RUNG_RADIUS = 0.026;
// High-detail clothed skin through the 20 cm slab, across all eight appearances
// in both directions, with clearance. The front lip retains the saved heels.
export const VERTICAL_CLIMB_HATCH = Object.freeze({
  minAcross: -0.57,
  maxAcross: 0.57,
  minForward: -1.04,
  maxForward: -0.16,
});
const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const phase = (t: number, a: number, b: number) => ease((t - a) / (b - a));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function ladderGeometry(
  lowerInput: readonly number[],
  upperInput: readonly number[],
  tileMetres: number,
) {
  const lower = point(lowerInput),
    upper = point(upperInput);
  const dx = upper[0] - lower[0],
    dz = upper[2] - lower[2],
    span = Math.hypot(dx, dz),
    forward: ClimbPoint = span > 1e-6 ? [dx / span, 0, dz / span] : [0, 0, 1];
  // The nearest square-cell edge is the roof support. Leave room for the
  // boot toe between the final rung and the wall under that edge.
  const inset = (0.5 * tileMetres) / Math.max(Math.abs(forward[0]), Math.abs(forward[2]));
  // A same-cell hatch sits behind the saved standing point, so its opening
  // does not remove the roof under the final heels.
  const baseSpan = span < 1e-6 ? -0.45 : 0,
    edgeSpan = span < 1e-6 ? baseSpan : Math.max(0, span - inset),
    ladderSpan = span < 1e-6 ? baseSpan : Math.max(0, edgeSpan - 0.1),
    height = upper[1] - lower[1];
  const base = [lower[0] + forward[0] * baseSpan, lower[1], lower[2] + forward[2] * baseSpan];
  const top = [lower[0] + forward[0] * ladderSpan, upper[1], lower[2] + forward[2] * ladderSpan];
  return {
    lower,
    upper,
    base,
    top,
    forward,
    span,
    baseSpan,
    edgeSpan,
    ladderSpan,
    height,
    hatch: span < 1e-6 ? VERTICAL_CLIMB_HATCH : undefined,
    steps: Math.max(2, Math.ceil(Math.hypot(ladderSpan - baseSpan, height) / LADDER_RUNG_DISTANCE)),
    halfWidth: LADDER_HALF_WIDTH,
    rungRadius: LADDER_RUNG_RADIUS,
  };
}
const defaultFeet: Record<ClimbSide, ClimbPoint> = {
  l: [0.2, 0.007, 0.147],
  r: [-0.2, 0.007, 0.147],
};
/** Keep the native moving side and within-step phase on another rung count. */
export function referenceClimbFraction(
  geometry: Pick<ClimbGeometry, 'steps'>,
  fraction: number,
  reference: Pick<ClimbGeometry, 'steps'>,
) {
  const t = Math.max(0, Math.min(1, fraction));
  if (t <= 0.12 || t >= 0.76 || geometry.steps === reference.steps) {
    return t;
  }
  const count = geometry.steps - 2,
    nativeCount = reference.steps - 2,
    q = ((t - 0.12) / 0.64) * count,
    step = Math.min(count - 1, Math.floor(q)),
    within = q - step,
    parity = step % 2;
  const estimate = ((t - 0.12) / 0.64) * nativeCount;
  let nativeStep = parity + 2 * Math.round((estimate - parity) / 2);
  nativeStep = Math.max(parity, Math.min(nativeCount - 1, nativeStep));
  if (nativeStep % 2 !== parity) {
    nativeStep--;
  }
  return 0.12 + (0.64 * (nativeStep + within)) / nativeCount;
}
/** Contact coordinates use metres above the lower end and toward the roof. */
export function sampleLadderClimb(
  geometry: ClimbGeometry,
  fraction: number,
  feetRest: Readonly<Record<ClimbSide, readonly number[]>> = defaultFeet,
) {
  const t = Math.max(0, Math.min(1, fraction)),
    { height: H, span, ladderSpan: L, edgeSpan: E, steps: N, baseSpan: B = 0 } = geometry,
    run = L - B;
  // A less steep ladder puts the upper palms farther in front of the chest.
  // Approach the iron slightly during the supported ascent, within 8 cm.
  const setback =
      Math.min(0.2, Math.max(0.12, 0.33 - 0.75 * (H ? run / H : 0))) +
      (B !== 0 ? 0.04 * phase(t, 0.18, 0.35) : 0),
    preparation = B !== 0 ? B : -0.16;
  const rung = (index: number) => ({
    height: index === 0 ? 0.007 : (H * index) / N + (index === N ? 0.022 : LADDER_RUNG_RADIUS),
    forward: index === 0 ? 0.147 : B + (run * index) / N,
  });
  const q = Math.max(0, Math.min(N - 2, ((t - 0.12) / 0.64) * (N - 2))),
    step = Math.min(N - 3, Math.floor(q)),
    u = q - step,
    moving = step % 2 === 0 ? 'r' : 'l';
  const indices = { l: 1 + 2 * Math.floor(step / 2), r: 2 * Math.floor((step + 1) / 2) };
  const root = { height: 0, forward: mix(0, preparation, phase(t, 0, 0.08)) };
  if (t >= 0.12) {
    root.height = Math.max(0, H - 0.85) * Math.min(1, (t - 0.12) / 0.64);
    root.forward = B + run * (H ? root.height / H : 0) - mix(0.2, setback, phase(t, 0.12, 0.7));
  }
  if (t >= 0.76) {
    root.height = mix(Math.max(0, H - 0.85), Math.max(0, H - 0.55), phase(t, 0.76, 0.91));
    root.forward = mix(
      B + run * (H ? Math.max(0, H - 0.85) / H : 0) - setback,
      E - 0.2,
      phase(t, 0.76, 0.85),
    );
  }
  if (t >= 0.85) {
    root.forward = mix(E - 0.2, E + 0.1, phase(t, 0.85, 0.91));
  }
  if (t >= 0.91) {
    root.height = mix(Math.max(0, H - 0.55), H, phase(t, 0.91, 1));
    root.forward = mix(E + 0.1, span, phase(t, 0.91, 1));
  }
  // Close the short preparation seam without moving a planted ground boot.
  if (t >= 0.08 && t < 0.12) {
    root.forward = mix(preparation, B - 0.2, phase(t, 0.08, 0.12));
  }
  const feet: Record<
    string,
    { position: number[]; planted: boolean; tilt: number; restWeight: number; roofWeight: number }
  > = {};
  const hands: Record<
    string,
    { position: number[]; planted: boolean; weight: number; roofWeight: number }
  > = {};
  for (const side of ['l', 'r'] as const) {
    const sign = side === 'l' ? 1 : -1,
      rest = point(feetRest[side]),
      backStep = side === 'r' && B !== 0 ? phase(t, 0, 0.04) : 0,
      start = { height: rest[1], forward: rest[2] + B * backStep },
      index = indices[side],
      a = index === 0 ? start : rung(index),
      b = rung(Math.min(N - 1, index + 2));
    let height = a.height,
      forward = a.forward,
      planted = true;
    if (t < 0.12) {
      const enter = side === 'l' ? phase(t, 0.04, 0.12) : 0;
      height = mix(start.height, rung(1).height, enter);
      forward = mix(start.forward, rung(1).forward, enter);
      planted = side === 'r' ? backStep === 0 || backStep === 1 : t <= 0.04 || t >= 0.12;
      if (side === 'r' && B !== 0) {
        height += 0.04 * Math.sin(Math.PI * backStep);
      }
      if (side === 'l') {
        height += 0.08 * Math.sin(Math.PI * enter);
      }
    } else if (t < 0.76 && side === moving) {
      const lift = phase(u, 0.03, 0.46);
      height = mix(a.height, b.height, lift) + 0.09 * Math.sin(Math.PI * lift);
      forward = mix(a.forward, b.forward, lift);
      planted = u <= 0.03 || u >= 0.46;
    } else if (t >= 0.76) {
      // Retain the foot that finished on each real rung. An even rung count
      // finishes with the opposite side high; the roof transfer clock is unchanged.
      const crestIndex =
        N > 2 && N % 2 === 0 ? (side === 'l' ? N - 1 : N - 2) : side === 'l' ? N - 2 : N - 1;
      height = rung(crestIndex).height;
      forward = rung(crestIndex).forward;
    }
    const roofForward = E + (B !== 0 ? (side === 'l' ? 0.35 : 0.55) : side === 'l' ? 0.1 : 0.32);
    if (t >= 0.76) {
      // The high left foot reaches the roof first on an even-rung ladder.
      // With that solid support, the right foot takes the final actual rung
      // before its unchanged .85→.91 roof transfer.
      const bridge = N > 2 && N % 2 === 0 && side === 'r' ? phase(t, 0.82, 0.85) : 0;
      if (bridge === 1) {
        height = rung(N - 1).height;
        forward = rung(N - 1).forward;
      } else if (bridge > 0) {
        height = mix(height, rung(N - 1).height, bridge) + 0.045 * Math.sin(Math.PI * bridge);
        forward = mix(forward, rung(N - 1).forward, bridge) - 0.03 * Math.sin(Math.PI * bridge);
      }
      const lift = phase(t, side === 'l' ? 0.76 : 0.85, side === 'l' ? 0.82 : 0.91),
        clear = phase(lift, 0, 0.55),
        step = phase(lift, 0.55, 1);
      height = lift <= 0.55 ? mix(height, H + 0.15, clear) : mix(H + 0.15, H + 0.007, step);
      forward = mix(forward - 0.04 * Math.sin(Math.PI * clear), roofForward, step);
      planted = (lift === 0 || lift === 1) && !(bridge > 0 && bridge < 1);
    }
    let spread = phase(t, 0.04, 0.12);
    if (side === 'r' && t < 0.12) {
      spread = 0;
    } else if (side === 'r' && step === 0 && t < 0.76) {
      spread = phase(u, 0.03, 0.46);
    }
    let footX = mix(rest[0], sign * 0.13, spread);
    const finish = phase(t, side === 'l' ? 0.91 : 0.96, side === 'l' ? 0.96 : 1);
    if (t >= 0.91) {
      height = H + mix(0.007, rest[1], finish) + 0.1 * Math.sin(Math.PI * finish);
      forward = mix(roofForward, span + rest[2], finish);
      footX = mix(sign * 0.13, rest[0], finish);
      planted = finish === 0 || finish === 1;
    }
    const lifted =
      side === 'r' && step === 0 && t < 0.76
        ? phase(u, 0.03, 0.46)
        : side === 'r' && t < 0.12
          ? 0
          : phase(t, 0.06, 0.12);
    const entering =
      side === 'l' ? phase(t, 0.04, 0.12) : t < 0.12 ? 0 : step === 0 ? phase(u, 0.03, 0.46) : 1;
    const roofWeight = phase(t, side === 'l' ? 0.76 : 0.85, side === 'l' ? 0.82 : 0.91);
    feet[side] = {
      position: [footX, height, forward],
      planted,
      tilt: 10 * lifted * (1 - roofWeight),
      restWeight: t >= 0.91 ? finish : 1 - entering,
      roofWeight,
    };
    const handA = rung(Math.min(N, index + 4)),
      handB = rung(Math.min(N, index + 6)),
      advance = side === moving ? phase(u, 0.55, 0.94) : 0;
    const hand = {
      roofWeight: 0,
      position: [
        sign * 0.15,
        mix(handA.height, handB.height, advance),
        mix(handA.forward, handB.forward, advance),
      ],
      planted: side !== moving || u <= 0.55 || u >= 0.94,
      weight: phase(t, 0, 0.1) * (1 - phase(t, 0.91, 0.98)),
    };
    if (t >= 0.76) {
      const reach = phase(t, side === 'l' ? 0.82 : 0.84, side === 'l' ? 0.84 : 0.86);
      hand.position = [
        sign * 0.15,
        H + mix(0.022, 0.055, reach) + 0.1 * Math.sin(Math.PI * reach),
        mix(L, E + 0.4, reach),
      ];
      hand.planted = reach === 0 || reach === 1;
      hand.roofWeight = reach;
    }
    hands[side] = hand;
  }
  return {
    fraction: t,
    root,
    feet,
    hands,
    lean: (0.2 + 0.25 * phase(t, 0.76, 0.83)) * phase(t, 0.02, 0.12) * (1 - phase(t, 0.91, 1)),
    crouch: 0.07 * phase(t, 0.7, 0.83) * (1 - phase(t, 0.91, 1)),
    kneeRise: 0.7 * phase(t, 0.6, 0.72) * (1 - phase(t, 0.91, 1)),
  };
}
