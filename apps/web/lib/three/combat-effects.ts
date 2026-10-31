import { required } from './required';
import { isMesh } from './scene-node-types';
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry, Material, Object3D, Scene } from 'three';
import { firearmFlightDuration } from '../../../../packages/game/battle-playback.js';
/** Positions use grid X/Y and an absolute metric height. No battle state crosses this boundary. */
export type EffectPoint = {
  x: number;
  y: number;
  height: number;
  tacticalLevel?: number;
  fraction?: number;
};
export type EffectLanding = {
  x: number;
  y: number;
  elevation: number;
  tacticalLevel?: number;
};
export type EffectImpact = EffectPoint & {
  outcome?: 'hit' | 'cover' | 'miss' | null;
  material?: string;
};
export type GrenadeEffectVisual = {
  visible: boolean;
  source: EffectPoint;
  impact: EffectPoint;
  landing: EffectLanding;
  points: readonly EffectPoint[];
  radius: number;
  detonated: boolean;
  contacts?: readonly EffectPoint[];
};
export type KnifeEffectVisual = {
  visible: boolean;
  source: EffectPoint;
  impact: EffectPoint;
  weapon?: number;
  landing?: EffectLanding;
};
export type FirearmEffectVisual = {
  visible: boolean;
  source: EffectPoint;
  impact: EffectPoint;
  points?: readonly EffectPoint[];
  outcome: 'hit' | 'cover' | 'miss' | 'pellets' | null;
  material?: string;
  spread?: boolean;
  discharge?: boolean;
  shotHand?: 'primary' | 'offhand';
  shotId?: string | number;
  bodyTargetKey?: string;
  sourceBodyKey?: string;
};
export type ArtilleryEffectVisual = {
  visible: boolean;
  source: EffectPoint;
  impact?: EffectPoint;
  points?: readonly EffectPoint[];
  impacts?: readonly EffectImpact[];
  canister?: boolean;
  discharge?: boolean;
  cannonId?: string;
};
type TimedEvent = {
  id: string;
  startedAtSeconds: number;
  durationSeconds?: number;
  dischargeAnchor?: EffectPoint;
  actorKey?: string;
  cannonId?: string;
  renderedPath?: {
    source: EffectPoint;
    impact: EffectPoint;
    points: readonly EffectPoint[];
  };
};
export type CombatEffectEvent = TimedEvent &
  (
    | {
        kind: 'grenade';
        visual: GrenadeEffectVisual;
        stage?: 'effect';
      }
    | {
        kind: 'knife';
        visual: KnifeEffectVisual;
        stage?: 'effect';
      }
    | {
        kind: 'firearm';
        visual: FirearmEffectVisual;
        stage: 'projectile' | 'impact';
      }
    | {
        kind: 'artillery';
        visual: ArtilleryEffectVisual;
        stage?: 'projectile' | 'impact' | 'effect';
      }
  );
export type CombatEffectsInput = {
  events?: readonly CombatEffectEvent[];
  timeSeconds?: number;
  reducedMotion?: boolean;
};
export type CombatEffectsOptions = {
  tileMetres: number;
};
type AnimatedPart = {
  mesh: Object3D;
  draw: (elapsed: number, reduced: boolean) => void;
};
type Entry = {
  event: CombatEffectEvent;
  signature: string;
  group: Group;
  parts: AnimatedPart[];
  materials: Set<Material>;
  duration: number;
};
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const optional = (
  value: Record<string, unknown>,
  key: string,
  check: (value: unknown) => boolean,
) => value[key] === undefined || check(value[key]);
const finitePoint = (point: unknown): point is EffectPoint =>
  object(point) &&
  finite(point['x']) &&
  finite(point['y']) &&
  finite(point['height']) &&
  optional(point, 'tacticalLevel', finite) &&
  optional(point, 'fraction', finite);
const finiteLanding = (point: unknown): point is EffectLanding =>
  object(point) &&
  finite(point['x']) &&
  finite(point['y']) &&
  finite(point['elevation']) &&
  optional(point, 'tacticalLevel', finite);
const validPoints = (points: unknown, min = 0): points is EffectPoint[] =>
  Array.isArray(points) &&
  points.length >= min &&
  points.length <= 256 &&
  points.every(finitePoint);
const samePoint = (a: EffectPoint | undefined, b: EffectPoint) =>
  Boolean(a) && a?.x === b.x && a.y === b.y && a.height === b.height;
const text = (value: unknown) => typeof value === 'string';
const boolean = (value: unknown) => typeof value === 'boolean';
const impactOutcome = (value: unknown) =>
  value === null || value === 'hit' || value === 'cover' || value === 'miss';
function validEvent(event: unknown): event is CombatEffectEvent {
  if (
    !object(event) ||
    typeof event['id'] !== 'string' ||
    !event['id'] ||
    !finite(event['startedAtSeconds']) ||
    event['startedAtSeconds'] < 0 ||
    !object(event['visual']) ||
    event['visual']['visible'] !== true
  ) {
    return false;
  }
  if (
    !optional(event, 'durationSeconds', (value) => finite(value) && value >= 0.02 && value <= 60) ||
    !optional(event, 'actorKey', text) ||
    !optional(event, 'cannonId', text) ||
    !optional(event, 'dischargeAnchor', finitePoint)
  ) {
    return false;
  }
  const path = event['renderedPath'];
  if (
    path !== undefined &&
    (!object(path) ||
      !finitePoint(path['source']) ||
      !finitePoint(path['impact']) ||
      !validPoints(path['points'], 2) ||
      !samePoint(path['points'][0], path['source']) ||
      !samePoint(path['points'].at(-1), path['impact']))
  ) {
    return false;
  }
  const visual = event['visual'];
  if (!finitePoint(visual['source'])) {
    return false;
  }
  switch (event['kind']) {
    case 'grenade':
      return (
        (event['stage'] === undefined || event['stage'] === 'effect') &&
        finitePoint(visual['impact']) &&
        finiteLanding(visual['landing']) &&
        validPoints(visual['points'], 2) &&
        finite(visual['radius']) &&
        visual['radius'] >= 0 &&
        visual['radius'] <= 20 &&
        boolean(visual['detonated']) &&
        optional(visual, 'contacts', (value) => validPoints(value))
      );
    case 'knife':
      return (
        (event['stage'] === undefined || event['stage'] === 'effect') &&
        finitePoint(visual['impact']) &&
        optional(visual, 'weapon', finite) &&
        optional(visual, 'landing', finiteLanding)
      );
    case 'firearm':
      return (
        finitePoint(visual['impact']) &&
        (visual['points'] === undefined ||
          (validPoints(visual['points'], 2) &&
            samePoint(visual['points'][0], visual['source']) &&
            samePoint(visual['points'].at(-1), visual['impact']))) &&
        (event['stage'] === 'projectile' || event['stage'] === 'impact') &&
        (visual['outcome'] === 'pellets' || impactOutcome(visual['outcome'])) &&
        optional(visual, 'material', text) &&
        optional(visual, 'spread', boolean) &&
        optional(visual, 'discharge', boolean) &&
        optional(visual, 'shotHand', (value) => value === 'primary' || value === 'offhand') &&
        optional(visual, 'shotId', (value) => text(value) || finite(value)) &&
        optional(visual, 'bodyTargetKey', text) &&
        optional(visual, 'sourceBodyKey', text)
      );
    case 'artillery':
      return (
        (event['stage'] === undefined ||
          event['stage'] === 'projectile' ||
          event['stage'] === 'impact' ||
          event['stage'] === 'effect') &&
        optional(visual, 'impact', finitePoint) &&
        optional(visual, 'points', (value) => validPoints(value, 2)) &&
        optional(
          visual,
          'impacts',
          (value) =>
            Array.isArray(value) &&
            value.length <= 64 &&
            value.every(
              (impact: unknown) =>
                object(impact) &&
                finitePoint(impact) &&
                optional(impact, 'outcome', impactOutcome) &&
                optional(impact, 'material', text),
            ),
        ) &&
        optional(visual, 'canister', boolean) &&
        optional(visual, 'discharge', boolean)
      );
    default:
      return false;
  }
}
function eventDuration(event: CombatEffectEvent) {
  return (
    event.durationSeconds ??
    (event.kind === 'grenade'
      ? 1.2
      : event.kind === 'knife'
        ? 0.6
        : event.kind === 'firearm'
          ? event.stage === 'projectile'
            ? firearmFlightDuration(event.visual) / 1000
            : 0.65
          : 1.2)
  );
}
function colourFor(impact: EffectImpact) {
  return impact.outcome === 'hit'
    ? '#794d40'
    : impact.material === 'wood'
      ? '#9b8060'
      : ['stone', 'brick'].includes(impact.material ?? '')
        ? '#aaa79b'
        : '#a89576';
}
/** A private cosmetic stream. It does not call or mutate the simulation RNG. */
function randomFor(id: string) {
  let state = 2166136261;
  for (const char of id) {
    state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let n = Math.imul(state ^ (state >>> 15), 1 | state);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
function pathSampler(points: readonly EffectPoint[], T: number) {
  const path = points.map((point) => new Vector3(point.x * T, point.height, point.y * T)),
    lengths = [0];
  for (let n = 1; n < path.length; n++) {
    lengths.push(required(lengths[n - 1]) + required(path[n]).distanceTo(required(path[n - 1])));
  }
  const fractions =
    points.every(
      (point, n) =>
        Number.isFinite(point.fraction) &&
        (!n || required(point.fraction) >= required(required(points[n - 1]).fraction)),
    ) &&
    required(points[0]).fraction === 0 &&
    required(points.at(-1)).fraction === 1
      ? points.map((point) => required(point.fraction))
      : lengths.map((length) => length / (lengths.at(-1) || 1));
  return (fraction: number, target: Vector3) => {
    const p = clamp(fraction);
    if (p <= 0) {
      return target.copy(required(path[0]));
    }
    if (p >= 1) {
      return target.copy(required(path.at(-1)));
    }
    let n = 1;
    while (n < fractions.length - 1 && required(fractions[n]) < p) {
      n++;
    }
    return target
      .copy(required(path[n - 1]))
      .lerp(
        required(path[n]),
        (p - required(fractions[n - 1])) /
          (required(fractions[n]) - required(fractions[n - 1]) || 1),
      );
  };
}
/** Draw only admitted records. Collision, trajectory solving and visibility belong to the game. */
export function createCombatEffects(scene: Scene, options: CombatEffectsOptions) {
  const T = options.tileMetres;
  if (!Number.isFinite(T) || T <= 0) {
    throw Error('Combat effects require a positive tileMetres.');
  }
  const root = new Group();
  root.name = 'combat-effects';
  scene.add(root);
  const geometries = new Map<string, BufferGeometry>(),
    entries = new Map<string, Entry>(),
    completed = new Map<string, string>();
  let time = 0,
    reduced = false,
    disposed = false,
    rejected = 0;
  const geometry = (kind: string) => {
    let g = geometries.get(kind);
    if (!g) {
      g =
        kind === 'box'
          ? new BoxGeometry(1, 1, 1)
          : kind === 'cone'
            ? new ConeGeometry(1, 1, 7)
            : kind === 'cylinder'
              ? new CylinderGeometry(1, 1, 1, 8)
              : kind === 'ring'
                ? new RingGeometry(0.94, 1, 48)
                : new IcosahedronGeometry(1, kind === 'smoke' ? 1 : 0);
      geometries.set(kind, g);
    }
    return g;
  };
  function remove(id: string) {
    const entry = entries.get(id);
    if (!entry) {
      return;
    }
    root.remove(entry.group);
    for (const material of entry.materials) {
      material.dispose();
    }
    entries.delete(id);
  }
  function create(event: CombatEffectEvent, signature: string): Entry {
    const group = new Group();
    group.name = `effect:${event.id}`;
    group.userData = { id: event.id, kind: event.kind, stage: event.stage };
    root.add(group);
    const entry: Entry = {
        event,
        signature,
        group,
        parts: [],
        materials: new Set(),
        duration: eventDuration(event),
      },
      rnd = randomFor(event.id);
    const at = (point: EffectPoint) => new Vector3(point.x * T, point.height, point.y * T);
    const mesh = (name: string, kind: string, colour: string, basic = false, opacity = 1) => {
      const material = basic
        ? new MeshBasicMaterial({
            color: colour,
            transparent: true,
            opacity,
            depthWrite: false,
            side: DoubleSide,
          })
        : new MeshStandardMaterial({
            color: colour,
            roughness: 0.85,
            metalness: kind === 'metal' ? 0.55 : 0,
            transparent: true,
            opacity,
            depthWrite: false,
            flatShading: true,
          });
      entry.materials.add(material);
      const object = new Mesh(geometry(kind), material);
      object.name = name;
      group.add(object);
      return object;
    };
    const add = (object: Object3D, draw: AnimatedPart['draw']) =>
      entry.parts.push({ mesh: object, draw });
    const opacity = (object: Mesh, value: number) => {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        material.opacity = clamp(value);
      }
    };
    function smoke(
      point: EffectPoint,
      start: number,
      count: number,
      scale: number,
      colour = '#6b6960',
      life = 0.65,
    ) {
      for (let n = 0; n < count; n++) {
        const object = mesh(`smoke:${n}`, 'smoke', colour),
          origin = at(point),
          angle = rnd() * Math.PI * 2,
          rad = rnd() * scale * 0.5,
          lift = 0.4 + rnd() * 0.7,
          size = scale * (0.35 + rnd() * 0.4);
        object.userData['role'] = 'smoke';
        add(object, (elapsed, quiet) => {
          const age = elapsed - start,
            p = clamp(age / life);
          object.visible = age >= 0 && age < life;
          object.position
            .copy(origin)
            .add(new Vector3(Math.cos(angle) * rad * p, lift * p, Math.sin(angle) * rad * p));
          object.scale.setScalar(size * (1 + p * 0.8));
          opacity(object, quiet ? 0.16 * (1 - p) : 0.46 * Math.sin(Math.PI * p));
        });
      }
    }
    function discharge(point: EffectPoint, toward: EffectPoint | undefined, large = false) {
      const flash = mesh('muzzle-flash', 'cone', '#f2c777', true),
        origin = at(point),
        direction = toward ? at(toward).sub(origin).normalize() : new Vector3(1, 0, 0);
      if (direction.lengthSq() === 0) {
        direction.set(1, 0, 0);
      }
      flash.userData['role'] = 'muzzle-flash';
      flash.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction);
      flash.position.copy(origin).addScaledVector(direction, large ? 0.23 : 0.11);
      flash.scale.set(large ? 0.18 : 0.08, large ? 0.48 : 0.24, large ? 0.18 : 0.08);
      add(flash, (elapsed, quiet) => {
        flash.visible = elapsed >= 0 && elapsed < (quiet ? 0.14 : 0.09);
        opacity(flash, quiet ? 0.4 : 1 - elapsed / 0.09);
      });
      smoke(point, 0.03, large ? 6 : 3, large ? 0.3 : 0.13, '#a3a092', large ? 0.9 : 0.6);
    }
    function impact(point: EffectImpact, start: number, large = false, readable = false) {
      if (!point.outcome) {
        return;
      }
      const origin = at(point),
        colour = colourFor(point),
        life = large ? 0.8 : 0.6;
      if (readable && point.outcome === 'cover') {
        // Force can expire inside an opaque observed solid. A brief contact
        // cue at the admitted point keeps that real strike readable there.
        const contact = mesh('impact-contact', 'metal', colour, true);
        contact.userData['role'] = 'impact';
        contact.position.copy(origin);
        contact.scale.setScalar(large ? 0.09 : 0.055);
        contact.material.depthTest = false;
        add(contact, (elapsed, quiet) => {
          const age = elapsed - start;
          contact.visible = age >= 0 && age < 0.18;
          opacity(contact, (quiet ? 0.4 : 0.85) * (1 - clamp(age / 0.18)));
        });
      }
      if (point.outcome !== 'hit') {
        const cloud = mesh('impact-dust', 'smoke', colour);
        cloud.userData['role'] = 'impact';
        add(cloud, (elapsed, quiet) => {
          const age = elapsed - start,
            p = clamp(age / life);
          cloud.visible = age >= 0 && age < life;
          cloud.position.copy(origin).add(new Vector3(0, p * 0.18, 0));
          cloud.scale.setScalar((large ? 0.18 : 0.065) + p * (large ? 0.45 : 0.16));
          opacity(cloud, (quiet ? 0.25 : 0.42) * (1 - p));
        });
      }
      for (let n = 0; n < (point.outcome === 'miss' ? 2 : large ? 12 : 4); n++) {
        const chip = mesh(`impact-chip:${n}`, point.material === 'wood' ? 'box' : 'metal', colour),
          angle = rnd() * Math.PI * 2,
          speed = (0.12 + rnd() * 0.4) * (large ? 2 : 1),
          up = 0.3 + rnd() * 0.5,
          origin = at(point),
          size = point.outcome === 'hit' ? 0.024 : 0.016 + rnd() * 0.014;
        chip.userData['role'] = 'impact';
        chip.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        chip.scale.set(size, size * (point.material === 'wood' ? 3 : 1), size);
        add(chip, (elapsed, quiet) => {
          const age = elapsed - start,
            p = clamp(age / life);
          chip.visible = age >= 0 && age < life && !quiet;
          chip.position
            .copy(origin)
            .add(
              new Vector3(
                Math.cos(angle) * speed * p,
                up * p - 0.75 * p * p,
                Math.sin(angle) * speed * p,
              ),
            );
          opacity(chip, 0.8 * (1 - p));
        });
      }
    }
    function flight(
      points: readonly EffectPoint[],
      duration: number,
      kind: 'grenade' | 'knife' | 'ball' | 'bullet',
    ) {
      const sample = pathSampler(points, T),
        body = new Group();
      body.name = 'projectile';
      body.userData['role'] = 'projectile';
      group.add(body);
      if (kind === 'knife') {
        const blade = mesh('knife-blade', 'cone', '#c2c7c1'),
          handle = mesh('knife-handle', 'cylinder', '#62492f');
        group.remove(blade, handle);
        body.add(blade, handle);
        blade.rotation.z = -Math.PI / 2;
        blade.scale.set(0.032, 0.24, 0.012);
        blade.position.x = 0.08;
        handle.rotation.z = Math.PI / 2;
        handle.scale.set(0.019, 0.105, 0.019);
        handle.position.x = -0.085;
      } else {
        if (kind === 'bullet') {
          const rim = mesh('bullet-rim', 'metal', '#38392e', true);
          group.remove(rim);
          body.add(rim);
          rim.scale.setScalar(0.052);
        }
        const ball = mesh(
          `${kind}-body`,
          'metal',
          kind === 'grenade' ? '#30362a' : kind === 'bullet' ? '#d2c5a4' : '#969789',
          kind === 'bullet',
        );
        group.remove(ball);
        body.add(ball);
        ball.scale.setScalar(kind === 'grenade' ? 0.073 : kind === 'ball' ? 0.09 : 0.038);
        if (kind === 'bullet') {
          ball.renderOrder = 1;
          ball.material.toneMapped = false;
        }
        if (kind === 'grenade') {
          const fuse = mesh('grenade-fuse', 'cylinder', '#b7a477');
          group.remove(fuse);
          body.add(fuse);
          fuse.position.y = 0.075;
          fuse.scale.set(0.012, 0.05, 0.012);
        }
      }
      const current = new Vector3(),
        ahead = new Vector3();
      add(body, (elapsed, quiet) => {
        const p = clamp(elapsed / duration);
        body.visible = elapsed >= 0 && elapsed < duration && !quiet;
        sample(p, current);
        body.position.copy(current);
        if (kind === 'knife') {
          sample(Math.min(1, p + 0.001), ahead);
          const direction = ahead.sub(current);
          if (direction.lengthSq()) {
            body.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), direction.normalize());
          }
        }
        body.traverse((object) => {
          if (isMesh(object)) {
            opacity(object, kind === 'bullet' ? 1 : p > 0.9 ? (1 - p) * 10 : 1);
          }
        });
      });
      return body;
    }
    function quietMarker(point: EffectPoint, start: number, end: number, colour: string) {
      const marker = mesh('reduced-motion-marker', 'metal', colour, true);
      marker.userData['role'] = 'reduced-motion-marker';
      marker.position.copy(at(point));
      marker.scale.setScalar(0.055);
      add(marker, (elapsed, quiet) => {
        marker.visible = quiet && elapsed >= start && elapsed < end;
        opacity(marker, 0.65);
      });
    }
    if (event.kind === 'grenade') {
      const v = event.visual,
        flightTime = Math.min(0.45, entry.duration * 0.45);
      flight(v.points, flightTime, 'grenade');
      quietMarker(v.impact, 0, entry.duration, '#b7ad87');
      for (const point of v.contacts ?? []) {
        impact({ ...point, outcome: 'miss' }, flightTime * clamp(point.fraction ?? 1));
      }
      if (v.detonated) {
        const ground = {
            x: v.landing.x,
            y: v.landing.y,
            height: v.landing.elevation,
          },
          radius = v.radius * T,
          ring = mesh('grenade-blast-radius', 'ring', '#d6b370', true),
          burst = mesh('grenade-blast', 'smoke', '#edc37a', true);
        ring.userData['role'] = 'blast-radius';
        ring.userData['radiusMetres'] = radius;
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(at(ground)).y += 0.012;
        burst.position.copy(at(ground)).y += 0.12;
        add(ring, (elapsed, quiet) => {
          const age = elapsed - flightTime,
            p = clamp(age / 0.7);
          ring.visible = age >= 0 && age < 0.7 && radius > 0;
          ring.scale.setScalar(radius);
          opacity(ring, (quiet ? 0.25 : 0.45) * (1 - p));
        });
        add(burst, (elapsed) => {
          const age = elapsed - flightTime,
            p = clamp(age / 0.3);
          burst.visible = age >= 0 && age < 0.3;
          burst.scale.setScalar(0.14 + Math.sin(Math.PI * p) * Math.min(0.65, radius * 0.18));
          opacity(burst, 1 - p);
        });
        smoke(
          ground,
          flightTime + 0.05,
          10,
          Math.min(1.1, Math.max(0.3, radius * 0.25)),
          '#535348',
          0.7,
        );
        impact({ ...ground, outcome: 'cover' }, flightTime, true);
      }
    } else if (event.kind === 'knife') {
      flight(
        [event.visual.source, event.visual.impact],
        Math.min(0.35, entry.duration * 0.65),
        'knife',
      );
      quietMarker(event.visual.impact, 0, entry.duration, '#c2c7c1');
    } else if (event.kind === 'firearm') {
      const v = { ...event.visual, ...event.renderedPath };
      if (event.stage === 'projectile') {
        if (v.discharge !== false) {
          discharge(event.dischargeAnchor ?? v.source, v.impact);
        }
        if (!v.spread) {
          flight(v.points ?? [v.source, v.impact], entry.duration, 'bullet');
        }
        quietMarker(v.impact, 0, entry.duration, '#b8b6a6');
      } else if (v.outcome === 'miss') {
        // A range endpoint is not a surface contact. Fade the bead without
        // inventing dust, fragments, blood or a reaction at the aimed body.
        const bead = mesh('miss-end', 'metal', '#d2c5a4', true);
        bead.userData['role'] = 'miss';
        bead.position.copy(at(v.impact));
        bead.scale.setScalar(0.038);
        add(bead, (elapsed, quiet) => {
          bead.visible = !quiet && elapsed >= 0 && elapsed < 0.18;
          opacity(bead, 0.7 * (1 - elapsed / 0.18));
        });
        quietMarker(v.impact, 0, entry.duration, '#b8b6a6');
      } else if (v.outcome && v.outcome !== 'pellets') {
        impact(
          {
            ...v.impact,
            outcome: v.outcome,
            ...(v.material ? { material: v.material } : {}),
          },
          0,
          false,
          true,
        );
        quietMarker(
          v.impact,
          0,
          entry.duration,
          colourFor({
            ...v.impact,
            outcome: v.outcome,
            ...(v.material ? { material: v.material } : {}),
          }),
        );
      }
    } else {
      const v = event.visual,
        stage = event.stage ?? 'effect',
        travel = Math.min(0.55, entry.duration * 0.55),
        end = v.impact ?? v.points?.at(-1),
        contacts = v.impacts ?? [];
      if (stage !== 'impact') {
        if (v.discharge !== false) {
          discharge(event.dischargeAnchor ?? v.source, end, true);
        }
        if (!v.canister && end) {
          flight(
            v.points ?? [v.source, end],
            stage === 'projectile' ? entry.duration : travel,
            'ball',
          );
        }
      }
      if (stage !== 'projectile') {
        for (const point of contacts) {
          impact(point, stage === 'impact' ? 0 : travel, true);
          quietMarker(point, stage === 'impact' ? 0 : travel, entry.duration, colourFor(point));
        }
      }
    }
    return entry;
  }
  function draw() {
    for (const [id, entry] of entries) {
      const elapsed = time - entry.event.startedAtSeconds;
      if (elapsed >= entry.duration) {
        completed.set(id, entry.signature);
        remove(id);
        continue;
      }
      entry.group.visible = elapsed >= 0;
      for (const part of entry.parts) {
        part.draw(elapsed, reduced);
      }
    }
  }
  return {
    update(input: CombatEffectsInput = {}) {
      if (disposed) {
        throw Error('Combat effects are disposed.');
      }
      if (['units', 'npcs', 'state', 'flight', 'trajectoryModel'].some((key) => key in input)) {
        throw Error(
          'Combat effects accept admitted visual records, not state or private flight data.',
        );
      }
      if (Number.isFinite(input.timeSeconds)) {
        time = required(input.timeSeconds);
      }
      reduced = Boolean(input.reducedMotion);
      const wanted = new Set<string>();
      for (const event of input.events ?? []) {
        if (!validEvent(event)) {
          rejected++;
          continue;
        }
        if (wanted.has(event.id)) {
          rejected++;
          continue;
        }
        wanted.add(event.id);
        const signature = JSON.stringify(event),
          current = entries.get(event.id);
        if (current?.signature === signature || completed.get(event.id) === signature) {
          continue;
        }
        remove(event.id);
        completed.delete(event.id);
        if (time - event.startedAtSeconds >= eventDuration(event)) {
          completed.set(event.id, signature);
          continue;
        }
        entries.set(event.id, create(event, signature));
      }
      for (const id of entries.keys()) {
        if (!wanted.has(id)) {
          remove(id);
        }
      }
      for (const id of completed.keys()) {
        if (!wanted.has(id)) {
          completed.delete(id);
        }
      }
      draw();
    },
    tick(_deltaSeconds: number, timeSeconds: number) {
      if (disposed) {
        return;
      }
      if (Number.isFinite(timeSeconds)) {
        time = timeSeconds;
      }
      draw();
    },
    inspect() {
      let meshes = 0,
        triangles = 0;
      root.traverse((object) => {
        if (isMesh(object)) {
          meshes++;
          triangles +=
            (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
        }
      });
      return {
        disposed,
        rejected,
        events: [...entries.values()].map((entry) => ({
          id: entry.event.id,
          kind: entry.event.kind,
          stage: entry.event.stage,
          elapsed: time - entry.event.startedAtSeconds,
          duration: entry.duration,
        })),
        meshes,
        triangles,
        geometries: geometries.size,
      };
    },
    dispose() {
      if (disposed) {
        return;
      }
      for (const id of entries.keys()) {
        remove(id);
      }
      completed.clear();
      for (const g of geometries.values()) {
        g.dispose();
      }
      geometries.clear();
      scene.remove(root);
      disposed = true;
    },
  };
}
