import { register } from 'node:module';
register('../tools/test-render-loader.ts', import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import type { ActorEntry } from '../apps/web/lib/three/presentation.ts';
import { manifest } from './published-actor-fixture.ts';
const { readCharacterManifest } =
  await import('../apps/web/lib/three/character-manifest-values.ts');
const { ActorCueStore } = await import('../apps/web/lib/three/actor-cue-store.ts');
const { readCampaignSaveRequest } = await import('../apps/web/lib/campaign-save-values.ts');
const { initialCampaign } = await import('../packages/game/campaign.js');

void test('published character manifest admits native variants and rejects malformed nested transforms', () => {
  assert.equal(readCharacterManifest(manifest), manifest);
  for (const value of [
    { ...manifest, equipment: { ...manifest.equipment, url: 42 } },
    { ...manifest, sockets: { handRight: { node: 'hand_r', position: [0, NaN, 0] } } },
    {
      ...manifest,
      animationLibraries: {
        invalid: { url: 'animations.glb', clips: { idle: { name: 'idle', loop: 'true' } } },
      },
    },
  ]) {
    assert.throws(() => readCharacterManifest(value), /character manifest/i);
  }
});
void test('actor cue lifecycle observes copied values, removes departed actors and ignores stale completions', () => {
  let now = 100,
    notifications = 0;
  const store = new ActorCueStore(() => now),
    unsubscribe = store.subscribe(() => {
      notifications++;
    });
  const entry: ActorEntry = {
    key: 'unit:p',
    kind: 'unit',
    actor: { id: 'p', name: 'P', hp: 100, maxHp: 100, energy: 100, x: 0, y: 0 },
  };
  store.observe('visit:1', [entry]);
  assert.deepEqual(store.getSnapshot(), {});
  entry.actor.hp = 90;
  now = 200;
  store.observe('visit:1', [entry]);
  const hit = store.getSnapshot()[entry.key];
  assert.ok(hit);
  assert.equal(hit.action, 'hit');
  assert.equal(hit.startedAt, 200);
  const unchanged = store.getSnapshot();
  store.observe('visit:1', [entry]);
  assert.equal(store.getSnapshot(), unchanged);
  store.accepted('p', 'reload');
  const reload = store.getSnapshot()[entry.key];
  assert.ok(reload);
  assert.equal(reload.action, 'reload');
  store.complete(entry.key, hit.id);
  assert.equal(store.getSnapshot()[entry.key], reload);
  store.complete(entry.key, reload.id);
  assert.deepEqual(store.getSnapshot(), {});
  store.accepted('p', 'reload');
  store.observe('visit:1', []);
  assert.deepEqual(store.getSnapshot(), {});
  store.observe('visit:1', [entry]);
  assert.deepEqual(store.getSnapshot(), {});
  store.accepted('p', 'reload');
  store.observe('visit:2', [entry]);
  assert.deepEqual(store.getSnapshot(), {});
  const count = notifications;
  unsubscribe();
  store.accepted('p', 'reload');
  assert.equal(notifications, count);
});
void test('campaign save admission retains migrated snapshot and validates transport revision', () => {
  const campaign = initialCampaign(19),
    request = {
      id: 1,
      sessionId: campaign.gameSessionId ?? 'local:1',
      revision: campaign.gameRevision,
      requestId: 'local:1:1',
      campaign,
      battle: null,
    };
  const admitted = readCampaignSaveRequest(structuredClone(request));
  assert.equal(admitted.campaign.gameRevision, campaign.gameRevision);
  assert.equal(admitted.battle, null);
  assert.equal(admitted.requestId, request.requestId);
  assert.throws(() => readCampaignSaveRequest({ ...request, requestId: 1 }), /identidad/);
  assert.throws(
    () =>
      readCampaignSaveRequest({ ...structuredClone(request), revision: campaign.gameRevision + 1 }),
    /revisión/,
  );
  assert.throws(() => readCampaignSaveRequest({ ...request, campaign: {} }));
  assert.throws(() => readCampaignSaveRequest({ ...structuredClone(request), battle: {} }));
});

const { Scene } = await import('three');
const { createSectorWorld } = await import('../apps/web/lib/three/sector-world.ts');
const { isMesh } = await import('../apps/web/lib/three/scene-node-types.ts');
import type { WorldBuilding, WorldInput, WorldTile } from '../apps/web/lib/three/world-types.ts';
function buildingScene(kind: string): WorldInput {
  const building: WorldBuilding = {
    id: 'building:1',
    kind,
    x: 1,
    y: 1,
    width: 7,
    height: 7,
    rooms: [
      {
        id: 'room:1',
        cells: [
          { x: 3, y: 3 },
          { x: 4, y: 3 },
        ],
      },
    ],
  };
  const tiles: WorldTile[] = Array.from({ length: 81 }, (_, index) => ({
    type: 'grass',
    x: index % 9,
    y: Math.floor(index / 9),
  }));
  for (const tile of tiles) {
    if (tile.x >= 1 && tile.x <= 7 && tile.y >= 1 && tile.y <= 7) {
      tile.buildingId = building.id;
      tile.type = tile.x === 1 || tile.x === 7 || tile.y === 1 || tile.y === 7 ? 'wall' : 'floor';
    }
  }
  const door = tiles.find((tile) => tile.x === 4 && tile.y === 7);
  assert.ok(door);
  door.type = 'door';
  return {
    terrain: {
      width: 9,
      height: 9,
      tiles,
      buildings: [building],
      lights: [{ id: 'fire', x: 0, y: 0, type: 'campfire' }],
    },
    cannons: [{ id: 'gun', x: 0, y: 8, type: 'field8', loaded: true }],
    loot: [{ id: 'ground', x: 8, y: 0, item: 'ration', count: 1 }],
  };
}
void test('world construction keeps finite geometry, retained nodes, cannon anchors and disposal across building families', () => {
  for (const kind of [
    'house',
    'posta',
    'barracks',
    'church',
    'chapel',
    'cabildo',
    'townhall',
    'palace',
    'pulperia',
    'warehouse',
    'depot',
    'farmhouse',
    'smithy',
    'stable',
  ]) {
    const scene = new Scene(),
      world = createSectorWorld(scene, {
        tileMetres: 1.2360585147470482,
        assetUrl: (path) => path,
      }),
      input = buildingScene(kind);
    world.update(input);
    world.tick(0.1, 1);
    const first = world.inspect();
    assert.ok(first.meshes > 0, kind);
    assert.ok(first.triangles > 0, kind);
    assert.ok(world.anchor('gun', 'muzzle'), kind);
    let disposed = 0;
    scene.traverse((node) => {
      if (isMesh(node)) {
        const positions = node.geometry.getAttribute('position');
        for (let index = 0; index < positions.count; index++) {
          assert.ok(
            [positions.getX(index), positions.getY(index), positions.getZ(index)].every(
              Number.isFinite,
            ),
            kind,
          );
        }
        node.geometry.addEventListener('dispose', () => {
          disposed++;
        });
      }
    });
    world.update(input);
    assert.deepEqual(world.inspect(), first, kind);
    world.update({ ...input, revealedRooms: ['room:1'] });
    assert.ok(world.inspect().meshes > 0, kind);
    world.dispose();
    assert.equal(scene.children.length, 0, kind);
    assert.equal(world.inspect().disposed, true);
    assert.ok(disposed > 0, kind);
    assert.equal(world.anchor('gun', 'muzzle'), null);
    assert.throws(() => world.update(input), /disposed/);
    world.dispose();
  }
});

void test('native sampling retains the GLTF cubic spline interpolant and its tangent layout', async () => {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { nativeInterpolant } = await import('../apps/web/lib/three/native-interpolant.ts');
  const values = new Float32Array([0, 1, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0]);
  const document = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'sample' }],
    buffers: [{ byteLength: values.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 8 },
      { buffer: 0, byteOffset: 8, byteLength: 72 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
      { bufferView: 1, componentType: 5126, count: 6, type: 'VEC3' },
    ],
    animations: [
      {
        name: 'native-cubic',
        channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }],
        samplers: [{ input: 0, output: 1, interpolation: 'CUBICSPLINE' }],
      },
    ],
  };
  const json = Buffer.from(JSON.stringify(document));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const bytes = Buffer.alloc(12 + 8 + jsonLength + 8 + values.byteLength);
  bytes.writeUInt32LE(0x46546c67, 0);
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(jsonLength, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  bytes.fill(32, 20, 20 + jsonLength);
  json.copy(bytes, 20);
  bytes.writeUInt32LE(values.byteLength, 20 + jsonLength);
  bytes.writeUInt32LE(0x004e4942, 24 + jsonLength);
  Buffer.from(values.buffer).copy(bytes, 28 + jsonLength);
  const loaded = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
  const clip = loaded.animations[0];
  assert.ok(clip);
  const track = clip.tracks[0];
  assert.ok(track);
  const sample = Array.from(nativeInterpolant(track).evaluate(0.5));
  assert.deepEqual(sample, [1.5, 0, 0]);
});
