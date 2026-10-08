// Sample actual exported neck and collar triangles. This is a bounded native
// motion gate, not a cloth simulation or an all-action clearance guarantee.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from '../../web/node_modules/sharp/lib/index.js';
import {AnimationMixer, LoopOnce, Ray, Triangle, Vector3, Box3} from '../../web/node_modules/three/build/three.module.js';
import {clone} from '../../web/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import {publishedActor, manifest} from '../../tests/published-actor-fixture.mjs';

const library = new URL('../../web/public/models/characters/', import.meta.url);
const names = ['stand.idle.unarmed', 'stand.aim.short-gun', 'stand.aim.long-gun',
  'stand.run.long-gun', 'stand.slash.blade.backhand', 'stand.punch.unarmed',
  'crouch.idle.unarmed', 'crouch.aim.long-gun', 'prone.idle.unarmed', 'prone.aim.long-gun'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function edgeCrosses(a, b) {
  for (const [p, q] of [[a.a, a.b], [a.b, a.c], [a.c, a.a]]) {
    const direction = q.clone().sub(p), length = direction.length();
    if (length < 1e-8) continue;
    const hit = new Ray(p.clone(), direction.divideScalar(length)).intersectTriangle(b.a, b.b, b.c, false, new Vector3());
    if (hit) {
      const distance = hit.distanceTo(p);
      if (distance > 1e-7 && distance < length - 1e-7) return true;
    }
  }
  return false;
}

function posed(mesh, faces) {
  mesh.skeleton.update();
  return faces.map(ids => {
    const points = ids.map(i => mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld));
    return {triangle: new Triangle(...points), box: new Box3().setFromPoints(points)};
  });
}

async function review(preset, lod) {
  const asset = await publishedActor(preset, lod), model = clone(asset.body.scene);
  const outfit = model.getObjectByName(`Human_outfit_LOD${lod}`);
  let skin;
  model.traverse(object => { if (object.isSkinnedMesh && object.material.name === 'Face_Skin') skin = object; });
  assert.ok(outfit && skin, `${preset} LOD${lod}: missing coat or accepted neck`);
  const bytes = readFileSync(new URL(`${preset}-lod${lod}.glb`, library));
  const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const material = doc.materials.find(value => value.name === 'Apparel_Atlas');
  const uri = doc.images[doc.textures[material.pbrMetallicRoughness.baseColorTexture.index].source].uri;
  const {data, info} = await sharp(new URL(uri, library).pathname).raw().toBuffer({resolveWithObject: true});
  function selected(mesh, cloth) {
    const attributes = mesh.geometry.attributes, index = mesh.geometry.index, faces = [];
    for (let k = 0; k < index.count; k += 3) {
      const ids = [index.getX(k), index.getX(k + 1), index.getX(k + 2)];
      const points = ids.map(i => new Vector3().fromBufferAttribute(attributes.position, i));
      if (!points.every(p => p.y > 1.485 && p.y < 1.570 && Math.abs(p.x) < .14 && Math.abs(p.z) < .15)) continue;
      if (cloth) {
        const i = ids[0];
        const x = Math.min(info.width - 1, Math.max(0, Math.floor(attributes.uv.getX(i) * info.width)));
        const y = Math.min(info.height - 1, Math.max(0, Math.floor(attributes.uv.getY(i) * info.height)));
        const n = (y * info.width + x) * info.channels;
        if (!(data[n] > data[n + 1] * 1.7 && data[n + 1] < 90)) continue;
      }
      faces.push(ids);
    }
    assert.ok(faces.length, `${preset} LOD${lod}: no ${cloth ? 'collar' : 'neck'} triangles selected`);
    return faces;
  }
  const faces = {skin: selected(skin, false), collar: selected(outfit, true)};
  const mixer = new AnimationMixer(model), samples = [['REST', 0]];
  for (const name of names) {
    const clip = asset.animation.animations.find(value => value.name === name);
    assert.ok(clip, name);
    for (let i = 0; i <= Math.ceil(clip.duration * 30); i++) samples.push([name, Math.min(i / 30, clip.duration)]);
  }
  const crossingFrames = [];
  for (const [name, time] of samples) {
    mixer.stopAllAction();
    if (name !== 'REST') {
      const action = mixer.clipAction(asset.animation.animations.find(value => value.name === name));
      action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play(); mixer.setTime(time);
    }
    model.updateMatrixWorld(true);
    const neck = posed(skin, faces.skin), collar = posed(outfit, faces.collar);
    let crossings = 0;
    for (const c of collar) for (const s of neck) {
      if (c.box.intersectsBox(s.box) && (edgeCrosses(c.triangle, s.triangle) || edgeCrosses(s.triangle, c.triangle))) crossings++;
    }
    if (crossings) crossingFrames.push({name, time, triangleCrossings: crossings});
  }
  const bank = manifest.animationLibraries[asset.appearance.animationLibrary];
  return {preset, lod, bodySha256: digest(bytes), bankSha256: digest(readFileSync(new URL(bank.url.split('/').at(-1), library))),
    selectedTriangles: {neck: faces.skin.length, collar: faces.collar.length}, samples: samples.length, crossingFrames};
}

const rows = [];
for (const preset of ['granadero', 'royalist']) for (const lod of [0, 1, 2]) {
  const row = await review(preset, lod); rows.push(row); console.log(JSON.stringify(row));
}
const report = {method: 'Actual skinned triangle edge intersections at 30 Hz; native clips only',
  limits: 'Rest-space neck band 1.485–1.570 m; edge crossings only, not positive clearance or wholly contained penetration. No collar self-intersection, crossfade or paid-contact acceptance claim.', clips: names, rows};
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
assert.ok(rows.every(row => row.crossingFrames.length === 0), 'Military collar crosses the accepted neck surface');
