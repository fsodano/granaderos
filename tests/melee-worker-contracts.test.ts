import { register } from 'node:module';
register('../tools/test-render-loader.ts', import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
const { Group, AnimationMixer, Vector3 } = await import('three');
import { publishedActor } from './published-actor-fixture.ts';
const { NativeMeleeContactFit } = await import('../apps/web/lib/three/melee-contact-fit.ts');
const { snapshotActor, restoreActor, snapshotCalibration, restoreCalibration } =
  await import('../apps/web/lib/three/melee-worker-snapshot.ts');
const { readReadyMeleeSamples } = await import('../apps/web/lib/three/melee-worker-values.ts');

async function sampledActor() {
  const asset = await publishedActor('granadero'),
    root = new Group(),
    model = asset.body.scene;
  root.add(model);
  root.updateMatrixWorld(true);
  const restored = restoreActor(snapshotActor(root, model)),
    pattern = asset.appearance.parts?.['footwear'];
  assert.ok(pattern);
  const footwear = pattern.replace('{lod}', String(asset.lod));
  return { ...restored, asset, footwear };
}
const emptyCache = () => ({
  core: [],
  recipes: [],
  names: [],
  previewLegs: [],
  gait: { step: 0, foot: 0, sole: 0, boot: 0 },
});
void test('published actor snapshot preserves skeleton, skin buffers and native transforms', async () => {
  const actor = await sampledActor(),
    snapshot = snapshotActor(actor.root, actor.model),
    restored = restoreActor(snapshot);
  const actual = snapshotActor(restored.root, restored.model);
  assert.deepEqual(actual, snapshot);
  const fit = new NativeMeleeContactFit(restored.model, restored.root, actor.footwear);
  assert.equal(fit.canFitPairedStrike, true);
  const calibration = snapshotCalibration(fit);
  assert.equal(calibration.limbs.length, 4);
  assert.equal(calibration.soles.length, 2);
  restoreCalibration(fit, calibration);
  assert.deepEqual(snapshotCalibration(fit), calibration);
  fit.dispose();
});
void test('sampler transfer has one owner and failed admission restores previous calibration', async () => {
  const actor = await sampledActor(),
    prepared = new NativeMeleeContactFit(actor.model, actor.root, actor.footwear),
    fit = new NativeMeleeContactFit(actor.model, actor.root, actor.footwear);
  const calibration = snapshotCalibration(fit);
  assert.equal(prepared.initializeCachedSample(emptyCache()), true);
  const rollback = fit.preserveAttempt();
  fit.takeSamplingFrom(prepared);
  assert.equal(prepared.hasSamplingContext, false);
  assert.equal(fit.hasSamplingContext, true);
  assert.throws(() => fit.takeSamplingFrom(prepared), /ALREADY_OWNED/);
  fit.finalizeCachedSample();
  fit.admitGait({ step: 1, foot: 2, sole: 3, boot: 4 });
  assert.throws(() => fit.admitGait({ step: 2, foot: 2, sole: 3, boot: 4 }), /CHANGED_GAIT/);
  fit.releaseSampling();
  rollback();
  assert.equal(fit.hasSamplingContext, false);
  assert.deepEqual(fit.gaitCalibration(), emptyCache().gait);
  assert.deepEqual(snapshotCalibration(fit), calibration);
  prepared.dispose();
  fit.dispose();
});
void test('published native pose cache admits complete samples and rejects malformed rows', async () => {
  const actor = await sampledActor(),
    fit = new NativeMeleeContactFit(actor.model, actor.root, actor.footwear),
    clip = actor.asset.animation.animations.find((value) => value.name === 'stand.butt.long-gun');
  assert.ok(clip);
  fit.initializeCachedSample(emptyCache());
  const native = fit.nativePoseCacheFor(clip, clip.duration / 2);
  const seed = {
    hand: new Vector3(),
    body: new Vector3(),
    step: new Vector3(),
    rearStep: new Vector3(),
    twoHands: true,
    contact: clip.duration / 2,
    duration: clip.duration,
  };
  const settled = fit.settledPoseCacheFor(clip, seed);
  const packet = { id: 1, cache: emptyCache(), native, settled, pairs: [], workerMs: 1 };
  assert.deepEqual(readReadyMeleeSamples(packet), packet);
  assert.ok(native.rows.length > 100);
  assert.ok(settled.rows.length > 0);
  for (const change of [
    { native: { ...native, rows: [{ time: 0, values: new Float64Array(1) }] } },
    { native: { ...native, rows: [{ time: NaN, values: native.rows.at(0)?.values }] } },
    { settled: { ...settled, rows: [{ ...settled.rows[0], feet: [[0, 0, 0]] }] } },
    { pairs: [[0, Infinity]] },
    { cache: { ...emptyCache(), core: [{ name: 'Root', low: [0, 0], high: [1, 1, 1] }] } },
  ]) {
    assert.throws(
      () => readReadyMeleeSamples({ ...packet, ...change }),
      /Invalid melee preparation/,
    );
  }
  // Native samples reproduce the authored pose, independent of cache transport.
  const mixer = new AnimationMixer(actor.model),
    action = mixer.clipAction(clip).play(),
    row = native.rows.find((value) => value.time === 0);
  action.timeScale = 0;
  action.time = 0;
  mixer.update(0);
  assert.ok(row);
  for (const [index, name] of native.names.entries()) {
    const node = actor.model.getObjectByName(name);
    assert.ok(node);
    assert.ok(
      node.position.distanceTo(new Vector3().fromArray(row.values, index * 10)) < 1e-8,
      name,
    );
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(actor.model);
  fit.dispose();
});
