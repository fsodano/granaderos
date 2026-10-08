import assert from 'node:assert/strict';
import test from 'node:test';
import { register } from 'node:module';
register('./tactical-render-loader.mjs', import.meta.url);
import { Vector3, Group } from '../web/node_modules/three/build/three.module.js';
import { publishedActor } from './published-actor-fixture.mjs';
import { createReachReviewBattle } from '../web/app/renderer-sandbox/reach-fixture.js';
import { actBattle, presentedActBattle } from '../game/tactical.js';
const { ActorRuntime } = await import('../web/lib/three/actor-runtime.ts');
const { presentActors } = await import('../web/lib/three/presentation.ts');
const { runPatientFitJob } = await import('../web/lib/three/heal-patient-fit-worker.ts');
const { admittedHealingIntervals } = await import('../web/lib/three/action-timing.ts');
const { presentedFrameDuration } = await import('../web/lib/useEnemyPlayback.ts');
function harness() { const original = Object.getOwnPropertyDescriptor(globalThis, 'Worker'), workers = [], settings = { constructorFail: false, postFail: false }; globalThis.Worker = class {
    jobs = [];
    terminated = false;
    constructor() { if (settings.constructorFail)
        throw Error('controlled construction failure'); workers.push(this); }
    postMessage(job) { if (settings.postFail)
        throw Error('controlled post failure'); this.jobs.push(structuredClone(job)); }
    terminate() { this.terminated = true; }
}; return { workers, settings, restore() { if (original)
        Object.defineProperty(globalThis, 'Worker', original);
    else
        delete globalThis.Worker; } }; }
async function pair(h, anatomy = 'male', lod = 0) {
    let state = createReachReviewBattle('prone');
    const id = 'reach-healer-' + anatomy, pid = 'reach-patient-' + anatomy, patient = state.units.find(u => u.id === pid);
    state = actBattle(state, { type: 'look', unitId: pid, x: patient.x + 1, y: patient.y + 1 });
    const saved = JSON.stringify(state), order = { type: 'heal', unitId: id, targetId: pid }, result = presentedActBattle(state, order);
    assert.deepEqual(result.state, actBattle(state, order));
    assert.equal(JSON.stringify(state), saved);
    const asset = await publishedActor(state.units.find(u => u.id === id).spriteAppearance, lod), entries = s => [id, pid].map(id => ({ key: 'unit:' + id, kind: 'unit', actor: s.units.find(u => u.id === id) })), show = (s, f, now) => presentActors(s, entries(s), {}, new Set(), { selected: id, mode: 'heal', frame: f, now }), initial = show(state, undefined, 0), p = new ActorRuntime(asset, initial.find(v => v.id === pid));
    let admitted = true;
    const resolve = () => admitted ? { model: p.model, root: p.root,nativePose:p.contactNativePose() } : undefined, d = new ActorRuntime(asset, initial.find(v => v.id === id), undefined, resolve), ownParent = new Group(), patientParent = new Group();
    ownParent.add(d.root);
    patientParent.add(p.root);
    for (let i = 0; i <= 10; i++) {
        p.tick(.1, i * 100);
        d.tick(.1, i * 100);
    }
    const frames = admittedHealingIntervals(result.frames), duration = frames.reduce((n, f) => n + presentedFrameDuration(f, state), 0), fit = d.patientFit, stock = d.equipment.userData.attached.find(n => n.userData.itemId === 'medkits'), gun = p.equipment.userData.attached.find(n => n.userData.itemId === '1800'), warm = initial.find(v => v.id === id).careWarm;
    assert.ok(warm);
    assert.ok(stock);
    assert.ok(gun);
    const c = { state, result, d, p, fit, stock, gun, warm, ownParent, patientParent, resolve, set admitted(v) { admitted = v; }, dispose() { d.dispose(); p.dispose(); } };
    c.warmNow = () => { d.prewarmContact(); const worker = h.workers.at(-1), job = worker?.jobs.at(-1); assert.ok(job); return { worker, job }; };
    c.frame = phase => { const index = phase < .25 ? 0 : 1, f = frames[index], now = 2000 + duration * phase, frame = { ...f, index, sequenceId: 'patient-current-worker', actionId: 1, startedAt: index === 0 ? 2000 : 2350, durationMs: index === 0 ? 350 : 1050, actionStartedAt: 2000, actionDurationMs: duration }; return { now, show: show(f.state, frame, now) }; };
    c.tick = (phase, delta = 1 / 120) => { const v = c.frame(phase); p.update(v.show.find(v => v.id === pid), v.now); d.update(v.show.find(v => v.id === id), v.now); p.tick(delta, v.now); d.tick(delta, v.now); return v; };
    return c;
}
function unchangedBody(c) { const rows = []; c.d.model.traverse(n => { if (n.isBone && !/^(upperarm_r|lowerarm_r|hand_r|(?:thumb|index|middle|ring|pinky)_0[123]_r)$/.test(n.name))
    rows.push([n.name, n.position.toArray(), n.scale.toArray(), n.quaternion.toArray()]); }); return rows; }
function nativeShape(c) { const rows = []; c.d.model.traverse(n => { if (n.isBone)
    rows.push([n.name, n.position.toArray(), n.scale.toArray()]); }); return { root: c.d.root.position.toArray(), rotation: c.d.root.quaternion.toArray(), rows }; }
test('pre-cue worker recipes retain the current paid cycle, floor and owned supply in both native anatomies/all LODs', async (t) => { const h = harness(), rows = []; try {
    for (const anatomy of ['male', 'female'])
        for (const lod of [0, 1, 2]) {
            const c = await pair(h, anatomy, lod);
            let original;
            try {
                original = new ActorRuntime(c.d.asset, c.d.visual);
                for (let i = 0; i <= 10; i++)
                    original.tick(.1, i * 100);
                const input = nativeShape(c), { worker, job } = c.warmNow(), packet = runPatientFitJob(job);
                assert.ok(packet.plan);
                worker.onmessage({ data: packet });
                assert.ok(c.fit.ready);
                let floor = Infinity, workContact = Infinity, maximumReach = 0;
                for (let n = 0; n <= 24; n++) {
                    const v = c.tick(n / 24);
                    original.update(v.show.find(v => v.id === 'reach-healer-' + anatomy), v.now);
                    original.tick(1 / 120, v.now);
                    assert.equal(c.fit.fallback, '');
                    assert.equal(c.fit.using, v.show.find(v => v.id === 'reach-healer-' + anatomy).cue.id);
                    floor = Math.min(floor, c.fit.floor);
                    maximumReach = Math.max(maximumReach, c.fit.reachError);
                    if (c.fit.contactWeight > .999)
                        workContact = Math.min(workContact, c.fit.contactError);
                    assert.deepEqual(nativeShape(c), nativeShape({ d: original }));
                    assert.deepEqual(unchangedBody(c), unchangedBody({ d: original }));
                    if (n < 23)
                        assert.equal(c.stock.parent.name, c.d.socket('hipLeft').name);
                    assert.equal(c.stock.visible, true);
                }
                assert.ok(floor >= .0015);
                assert.ok(workContact < 1e-6);
                assert.equal(maximumReach, 0);
                assert.equal(c.result.state.units.find(u => u.id === 'reach-healer-' + anatomy).ap, 75);
                assert.equal(c.result.state.units.find(u => u.id === 'reach-healer-' + anatomy).medkits, 1);
                assert.equal(c.result.state.units.find(u => u.id === 'reach-patient-' + anatomy).ap, 82);
                rows.push({ anatomy, lod, floor, workContact, maximumReach });
            }
            finally {
                original?.dispose();
                c.dispose();
            }
        }
}
finally {
    h.restore();
} t.diagnostic(JSON.stringify(rows)); });
const mutations = {
    'hidden patient ancestor': c => { c.patientParent.visible = false; },
    'hidden healer ancestor': c => { c.ownParent.visible = false; },
    'missing current patient': c => { c.admitted = false; },
    'changed healer model transform': c => { c.d.model.position.x += .01; },
    'changed healer root yaw': c => { c.d.root.rotation.y += .1; },
    'changed visible patient mesh': c => { let m; c.p.model.traverse(n => { if (!m && n.isSkinnedMesh && n.visible)
        m = n; }); m.visible = false; },
    'changed visible healer mesh': c => { let m; c.d.model.traverse(n => { if (!m && n.isSkinnedMesh && n.visible)
        m = n; }); m.visible = false; },
    'replaced patient geometry': c => { let m; c.p.model.traverse(n => { if (!m && n.isSkinnedMesh && n.visible)
        m = n; }); m.geometry = m.geometry.clone(); },
    'changed current patient native pose': c => { c.p.model.getObjectByName('thigh_r').rotation.x += .1; },
    'changed patient native scale': c => { c.p.model.getObjectByName('thigh_r').scale.x += .01; },
    'hidden owned supply': c => { c.stock.visible = false; },
    'hidden patient rifle': c => { c.gun.visible = false; },
    'changed patient rifle geometry': c => { let m; c.gun.traverse(n => { if (!m && n.isMesh)
        m = n; }); m.geometry = m.geometry.clone(); },
    'changed visible garment morph': c => { let m; c.p.model.traverse(n => { if (!m && n.isSkinnedMesh && n.visible)
        m = n; }); m.morphTargetInfluences = [.01]; },
    'changed visible patient mesh transform': c => { let m; c.p.model.traverse(n => { if (!m && n.isSkinnedMesh && n.visible)
        m = n; }); m.position.x += .01; },
    'changed owned supply position': c => { c.stock.position.x += .01; },
    'changed owned supply orientation': c => { c.stock.rotation.z += .01; },
    'changed patient lower spine': c => {c.p.model.getObjectByName('spine_01').rotation.x+=.1;},
    'changed patient current clip': c => {const v=c.p.contactNativePose();c.p.contactNativePose=()=>({...v,clip:v.clip.clone()});},
    'changed patient native phase without pose': c => {const v=c.p.contactNativePose();c.p.contactNativePose=()=>({...v,time:v.time+.4});},
    'partially weighted patient native clip': c => {const v=c.p.contactNativePose();c.p.contactNativePose=()=>({...v,weight:.5});},
    'nonfinite patient native weight': c => {const v=c.p.contactNativePose();c.p.contactNativePose=()=>({...v,weight:NaN});},
    'nonfinite patient native phase': c => {const v=c.p.contactNativePose();c.p.contactNativePose=()=>({...v,time:NaN});},
    'changed patient spine': c => {c.p.model.getObjectByName('spine_02').rotation.x+=.1;},
    'changed patient hand': c => {c.p.model.getObjectByName('hand_r').rotation.x+=.1;},
    'changed inverse skin bind': c => { let m; c.p.model.traverse(n => { if (!m && n.isSkinnedMesh && n.visible)
        m = n; }); const inverse = m.skeleton.boneInverses[0], old = inverse.elements[12]; inverse.elements[12] += .01; return () => { inverse.elements[12] = old; }; },
};
test('stale readiness cannot fit or join late during an admitted cue', async (t) => { const h = harness(); try {
    for (const [name, mutate] of Object.entries(mutations))
        for (const stage of ['delivery', 'first paid frame'])
            await t.test(name + ' at ' + stage, async () => { const c = await pair(h); let undo; try {
                const { worker, job } = c.warmNow(), packet = runPatientFitJob(job);
                if (stage === 'first paid frame') {
                    worker.onmessage({ data: packet });
                    assert.ok(c.fit.ready);
                }
                undo = mutate(c);
                if (stage === 'delivery') {
                    worker.onmessage({ data: packet });
                    assert.equal(c.fit.ready, undefined);
                }
                const v = c.frame(0);
                c.fit.restore();
                c.fit.apply(v.show.find(v => v.id === 'reach-healer-male').cue, 0, 1.4, c.resolve, 2);
                assert.equal(c.fit.plan, undefined);
                assert.equal(c.fit.fallback, v.show.find(v => v.id === 'reach-healer-male').cue.id);
                assert.equal(c.fit.contactWeight, 0);
            }
            finally {
                undo?.();
                c.dispose();
            } });
}
finally {
    h.restore();
} });
test('missing/failed worker and a late result preserve the whole native cue', async (t) => { for (const failure of ['not ready', 'constructor', 'post', 'error', 'late'])
    await t.test(failure, async () => { const h = harness(); let c; try {
        h.settings.constructorFail = failure === 'constructor';
        h.settings.postFail = failure === 'post';
        c = await pair(h);
        let packet, worker;
        if (!['not ready', 'constructor', 'post'].includes(failure)) {
            const w = c.warmNow();
            worker = w.worker;
            if (failure === 'error')
                worker.onmessage({ data: { id: w.job.id, error: 'controlled worker fault' } });
            if (failure === 'late')
                packet = runPatientFitJob(w.job);
        }
        else if (['constructor', 'post'].includes(failure))
            c.d.prewarmContact();
        c.tick(0);
        const cue = c.d.visual.cue.id;
        assert.equal(c.fit.fallback, cue);
        if (packet) {
            worker.onmessage({ data: packet });
            c.tick(.5);
            assert.equal(c.fit.fallback, cue);
            assert.equal(c.fit.plan, undefined);
            assert.equal(c.fit.contactWeight, 0);
        }
        assert.equal(c.stock.parent.name, c.d.socket('handRight', 'tool').name);
    }
    finally {
        c?.dispose();
        h.restore();
    } }); });
test('active lease changes start a bounded return and cannot resume the same cue', async (t) => { const h = harness(); try {
    for (const name of ['missing current patient', 'changed visible patient mesh', 'changed visible garment morph', 'changed inverse skin bind', 'hidden owned supply', 'changed patient rifle geometry', 'changed visible patient mesh transform', 'changed owned supply position', 'changed owned supply orientation', 'changed patient lower spine', 'changed patient spine', 'changed patient hand', 'changed patient current clip', 'changed patient native phase without pose', 'partially weighted patient native clip', 'nonfinite patient native weight', 'nonfinite patient native phase'])
        await t.test(name, async () => { const c = await pair(h); let undo; try {
            const { worker, job } = c.warmNow();
            worker.onmessage({ data: runPatientFitJob(job) });
            c.tick(0);
            c.tick(.5);
            assert.ok(c.fit.contactWeight > .999);
            c.fit.restore();
            undo = mutations[name](c);
            const cue = c.frame(.51).show.find(v => v.id === 'reach-healer-male').cue;
            c.fit.apply(cue, .51 * 1.4, 1.4, c.resolve, 2 + .51 * 1.4);
            assert.equal(c.fit.fallback, cue.id);
            assert.equal(c.fit.plan, undefined);
            assert.ok(c.fit.returning);
            assert.ok(c.fit.floor >= .0015);
            for (let i = 1; i <= 72; i++) {
                c.fit.restore();
                c.fit.apply(cue, (.51 + i / 120) * 1.4, 1.4, c.resolve, 2 + .51 * 1.4 + i / 120);
                assert.equal(c.fit.plan, undefined);
                const q = c.d.model.getObjectByName('hand_r').quaternion.toArray();
                assert.ok(q.every(Number.isFinite));
            }
            assert.equal(c.fit.returning, undefined);
        }
        finally {
            undo?.();
            c.dispose();
        } });
}
finally {
    h.restore();
} });

test('coherent current native idle breathing retains the prepared patient lease', async () => {
 const h=harness();try{for(const anatomy of ['male','female']){const c=await pair(h,anatomy);try{const {worker,job}=c.warmNow();worker.onmessage({data:runPatientFitJob(job)});assert.ok(c.fit.ready);for(let n=0;n<80;n++){c.p.tick(.025,1100+n*25);c.d.prewarmContact();assert.ok(c.fit.poseMatches(c.fit.ready.lease,c.resolve()));assert.equal(worker.jobs.length,1);}}finally{c.dispose();}}}finally{h.restore();}
});
test('a bounded unavailable plan is cached only for its exact current visible binding',async()=>{
 const h=harness();let c;try{c=await pair(h);const {worker,job}=c.warmNow();worker.onmessage({data:{id:job.id,plan:null,lift:0,workerMs:1}});assert.equal(c.fit.ready,undefined);assert.ok(c.fit.unavailable);for(let n=0;n<20;n++){c.p.tick(.025,1200+n*25);c.d.prewarmContact();}assert.equal(worker.jobs.length,1);let mesh;c.p.model.traverse(n=>{if(!mesh&&n.isSkinnedMesh&&n.visible)mesh=n;});mesh.geometry=mesh.geometry.clone();c.d.prewarmContact();assert.equal(worker.jobs.length,2);c.tick(0);assert.ok(c.fit.fallback);assert.equal(c.fit.contactWeight,0);}finally{c?.dispose();h.restore();}
});

test('the strict contact resolver reports only the current admitted loaded native clip and time',async()=>{const h=harness();let c;try{c=await pair(h);const {resolveContactTargetModel}=await import('../web/lib/three/contact-target-model.ts'),target=c.warm.targets[0],entry={visual:c.p.visual,runtime:c.p},a=resolveContactTargetModel(target,[c.p.visual],entry);assert.ok(a);assert.equal(a.nativePose.clip,c.p.contactNativePose().clip);assert.equal(a.nativePose.time,c.p.contactNativePose().time);c.p.tick(.1,1200);const b=resolveContactTargetModel(target,[c.p.visual],entry);assert.equal(b.nativePose.time,c.p.contactNativePose().time);assert.notEqual(a.nativePose.time,b.nativePose.time);assert.equal(resolveContactTargetModel(target,[],entry),undefined);}finally{c?.dispose();h.restore();}});

test('a changed admitted floor support record rejects delivery, admission and active contact',async(t)=>{const h=harness();try{for(const stage of ['delivery','first paid frame','active cue'])await t.test(stage,async()=>{const c=await pair(h);try{const {worker,job}=c.warmNow(),packet=runPatientFitJob(job),support=structuredClone(c.warm.support);assert.ok(support.floors.length);support.floors[0].height+=.01;if(stage==='delivery'){c.fit.prewarm({...c.warm,support},c.stock,c.d.socket('hipLeft'),c.resolve);worker.onmessage({data:packet});assert.equal(c.fit.ready,undefined);}else{worker.onmessage({data:packet});assert.ok(c.fit.ready);}if(stage==='active cue'){c.tick(0);c.tick(.5);assert.equal(c.fit.contactWeight,1);}const phase=stage==='active cue'?.51:0,original=c.frame(phase).show.find(v=>v.id==='reach-healer-male').cue,cue={...original,care:{...original.care,support}};c.fit.restore();c.fit.apply(cue,phase*1.4,1.4,c.resolve,2+phase*1.4);assert.equal(c.fit.fallback,cue.id);assert.equal(c.fit.plan,undefined);if(stage==='active cue'){assert.ok(c.fit.returning);assert.ok(c.fit.floor>=.0015);}else assert.equal(c.fit.contactWeight,0);}finally{c.dispose();}})}finally{h.restore();}});

test('absent Worker keeps native care for the whole cue without synchronous preparation or a late join',async()=>{const h=harness();let c;try{const ctor=globalThis.Worker;delete globalThis.Worker;c=await pair(h);c.fit.prepare=()=>{throw Error('Unexpected synchronous preparation')};c.d.prewarmContact();assert.equal(h.workers.length,0);c.tick(0);const cue=c.d.visual.cue.id;assert.equal(c.fit.fallback,cue);assert.equal(c.fit.plan,undefined);assert.equal(c.fit.contactWeight,0);assert.equal(c.stock.parent.name,c.d.socket('handRight','tool').name);globalThis.Worker=ctor;c.fit.prewarm(c.warm,c.stock,c.d.socket('hipLeft'),c.resolve);const worker=h.workers.at(-1);assert.ok(worker);worker.onmessage({data:runPatientFitJob(worker.jobs.at(-1))});c.tick(.5);assert.equal(c.fit.fallback,cue);assert.equal(c.fit.plan,undefined);assert.equal(c.fit.contactWeight,0);}finally{c?.dispose();h.restore();}});
