import { required } from './required';
import {
  CircleGeometry,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
} from 'three';
import type { Scene } from 'three';
import { corpseBloodShape } from '../../../../packages/game/scene-readability.js';
import type { ActorVisual } from './presentation';
type BloodActor = Pick<ActorVisual, 'key' | 'position' | 'action' | 'cue'>;
type Corpse = {
  key: string;
  position: [number, number, number];
};
type Burst = {
  corpse: Corpse;
  startedAt: number;
  height: number;
};
export const DEATH_BLOOD_SECONDS = 0.55;
const dead = (actor: BloodActor) =>
  actor.action === 'die' || actor.action === 'dead';
const valid = (actor: BloodActor) =>
  actor &&
  typeof actor.key === 'string' &&
  /^(unit|npc):.+/.test(actor.key) &&
  Array.isArray(actor.position) &&
  actor.position.length === 3 &&
  actor.position.every(Number.isFinite);
const fraction = (seed: number, n: number) =>
  ((Math.imul(seed + 1, 1597) + n * 2371) % 997) / 997;
const seedFor = (key: string) =>
  Array.from(key).reduce(
    (seed, char) => (seed * 31 + char.charCodeAt(0)) >>> 0,
    0,
  ) % 997;
/** Corpses are already admitted by presentation. No battle state or save data is owned here. */
export function createDeathBlood(scene: Scene) {
  const root = new Group();
  root.name = 'death-blood';
  scene.add(root);
  const poolGeometry = new CircleGeometry(1, 14);
  poolGeometry.rotateX(-Math.PI / 2);
  const dropGeometry = new IcosahedronGeometry(1, 0);
  const poolMaterial = new MeshBasicMaterial({
    color: '#84292b',
    transparent: true,
    opacity: 0.84,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const dropMaterial = new MeshBasicMaterial({
    color: '#8b292b',
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  let pools: InstancedMesh | undefined,
    drops: InstancedMesh | undefined,
    time = 0,
    reduced = false,
    disposed = false;
  const corpses = new Map<string, Corpse>(),
    bursts = new Map<string, Burst>(),
    observedLiving = new Set<string>(),
    emitted = new Set<string>(),
    transform = new Object3D();
  let emittedCount = 0;
  const allocate = (
    mesh: InstancedMesh | undefined,
    count: number,
    kind: 'stains' | 'droplets',
  ) => {
    if (mesh && mesh.instanceMatrix.count >= count) {
      return mesh;
    }
    if (mesh) {
      root.remove(mesh);
      mesh.dispose();
    }
    const next = new InstancedMesh(
      kind === 'stains' ? poolGeometry : dropGeometry,
      kind === 'stains' ? poolMaterial : dropMaterial,
      2 ** Math.ceil(Math.log2(Math.max(16, count))),
    );
    next.name = `death-blood:${kind}`;
    next.instanceMatrix.setUsage(DynamicDrawUsage);
    next.frustumCulled = false;
    next.raycast = () => {};
    next.count = 0;
    root.add(next);
    return next;
  };
  function drawPools() {
    if (!corpses.size) {
      if (pools) {
        pools.count = 0;
      }
      return;
    }
    pools = allocate(pools, corpses.size * 4, 'stains');
    let index = 0;
    for (const corpse of corpses.values()) {
      const shape = corpseBloodShape(corpse.key),
        angle = (shape.rotation * Math.PI) / 180,
        rx = shape.rx * 0.04,
        rz = shape.ry * 0.065;
      // Extend past the fallen torso so the ground mark remains readable at tactical zoom.
      for (const [x, z, sx, sz] of [
        [-0.035, 0, rx, rz],
        [0.3, 0.09, 0.2, 0.13],
        [-0.46, 0.13, 0.065, 0.04],
        [0.51, -0.14, 0.04, 0.028],
      ]) {
        transform.position.set(
          corpse.position[0] +
            required(x) * Math.cos(angle) -
            required(z) * Math.sin(angle),
          corpse.position[1] + 0.012,
          corpse.position[2] +
            required(x) * Math.sin(angle) +
            required(z) * Math.cos(angle),
        );
        transform.rotation.set(0, angle, 0);
        transform.scale.set(required(sx), 1, required(sz));
        transform.updateMatrix();
        pools.setMatrixAt(index++, transform.matrix);
      }
    }
    pools.count = index;
    pools.instanceMatrix.needsUpdate = true;
  }
  function drawBursts() {
    for (const [key, burst] of bursts) {
      if (time - burst.startedAt >= DEATH_BLOOD_SECONDS) {
        bursts.delete(key);
      }
    }
    if (reduced || !bursts.size) {
      if (drops) {
        drops.count = 0;
      }
      return;
    }
    drops = allocate(drops, bursts.size * 7, 'droplets');
    let index = 0;
    for (const burst of bursts.values()) {
      const age = time - burst.startedAt;
      if (age < 0) {
        continue;
      }
      const p = age / DEATH_BLOOD_SECONDS,
        seed = seedFor(burst.corpse.key);
      for (let n = 0; n < 7; n++) {
        const angle = fraction(seed, n) * Math.PI * 2,
          spread = 0.12 + fraction(seed, n + 7) * 0.22,
          size = (0.018 + fraction(seed, n + 14) * 0.012) * (1 - p * 0.7);
        transform.position.set(
          burst.corpse.position[0] + Math.cos(angle) * spread * p,
          burst.corpse.position[1] +
            0.02 +
            Math.max(
              0,
              burst.height * (1 - p * p) + 0.09 * Math.sin(p * Math.PI),
            ),
          burst.corpse.position[2] + Math.sin(angle) * spread * p,
        );
        transform.rotation.set(n, 0.8 * n, 0);
        transform.scale.set(size, size * 1.4, size);
        transform.updateMatrix();
        drops.setMatrixAt(index++, transform.matrix);
      }
    }
    drops.count = index;
    drops.instanceMatrix.needsUpdate = true;
  }
  return {
    update(
      input: {
        actors?: readonly BloodActor[];
        timeSeconds?: number;
        reducedMotion?: boolean;
      } = {},
    ) {
      if (disposed) {
        throw Error('Death blood is disposed.');
      }
      if (['units', 'npcs', 'state'].some((key) => key in input)) {
        throw Error(
          'Death blood accepts admitted actor visuals, not battle state.',
        );
      }
      if (Number.isFinite(input.timeSeconds)) {
        time = required(input.timeSeconds);
      }
      reduced = Boolean(input.reducedMotion);
      const visible = new Set<string>();
      corpses.clear();
      for (const actor of input.actors ?? []) {
        if (!valid(actor) || visible.has(actor.key)) {
          continue;
        }
        visible.add(actor.key);
        if (!dead(actor)) {
          observedLiving.add(actor.key);
          emitted.delete(actor.key);
          bursts.delete(actor.key);
          continue;
        }
        const corpse: Corpse = {
          key: actor.key,
          position: [...actor.position],
        };
        corpses.set(actor.key, corpse);
        const cue = actor.cue;
        if (
          observedLiving.has(actor.key) &&
          !emitted.has(actor.key) &&
          actor.action === 'die' &&
          cue?.action === 'die' &&
          Number.isFinite(cue.startedAt)
        ) {
          emitted.add(actor.key);
          const startedAt = cue.startedAt / 1000;
          if (
            !reduced &&
            time >= startedAt &&
            time - startedAt < DEATH_BLOOD_SECONDS
          ) {
            emittedCount++;
            bursts.set(actor.key, {
              corpse,
              startedAt,
              height:
                cue.fromPosture === 'prone'
                  ? 0.12
                  : cue.fromPosture === 'crouched'
                    ? 0.35
                    : 0.55,
            });
          }
        }
      }
      // Concealed or newly discovered bodies cannot supply an observed death.
      for (const key of observedLiving) {
        if (!visible.has(key)) {
          observedLiving.delete(key);
          emitted.delete(key);
          bursts.delete(key);
        }
      }
      for (const key of bursts.keys()) {
        if (!corpses.has(key)) {
          bursts.delete(key);
        }
      }
      if (reduced) {
        bursts.clear();
      }
      drawPools();
      drawBursts();
    },
    tick(timeSeconds: number) {
      if (disposed) {
        return;
      }
      if (Number.isFinite(timeSeconds)) {
        time = timeSeconds;
      }
      drawBursts();
    },
    inspect() {
      return {
        disposed,
        corpses: corpses.size,
        bursts: bursts.size,
        emitted: emittedCount,
        stainInstances: pools?.count ?? 0,
        dropletInstances: drops?.count ?? 0,
        drawCalls:
          Number(Boolean(pools?.count)) + Number(Boolean(drops?.count)),
      };
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      scene.remove(root);
      pools?.dispose();
      drops?.dispose();
      poolGeometry.dispose();
      dropGeometry.dispose();
      poolMaterial.dispose();
      dropMaterial.dispose();
      corpses.clear();
      bursts.clear();
      observedLiving.clear();
      emitted.clear();
    },
  };
}
