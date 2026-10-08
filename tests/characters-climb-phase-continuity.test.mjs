
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Vector3} from '../web/node_modules/three/build/three.module.js';
import {asset,visual,manifest,surface,vertices,sample,snapshot} from './helpers/climb-native-fixture.mjs';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const {TILE_METRES}=await import('../web/lib/three/projection.ts');
import {ladderGeometry,referenceClimbFraction} from '../game/climb-geometry.js';
const results=[];
const maxShift=(a,b)=>Math.max(0,...a.map((v,i)=>v.distanceTo(b[i])));
for(const id of ['granadero','woman-scout'])for(const lod of [0,1,2])for(const action of ['climbUp','climbDown'])for(const H of [2,4.2,5.6])test(`${id} LOD${lod} ${action} ${H}m: complete visible native surfaces cross all rung wraps continuously`,async()=>{
 const source=await asset(id,lod),spec=source.clips.find(s=>s.name==='life.'+action),g=ladderGeometry([0,1.2,0],[0,1.2+H,TILE_METRES],TILE_METRES),reference=ladderGeometry([0,0,0],[0,spec.climbSupport.height,spec.climbSupport.span],TILE_METRES),actor=new ActorRuntime(source,visual(id,action,{cue:undefined})),list=surface(actor),duration=Math.max(spec.duration,H/.65),edges=[];
 assert.ok(list.all.length>3000&&list.clothes.length>100&&list.head.length>100&&list.boots.length>100,'Full current visible body, clothes, head and boots');
 for(let step=1;step<g.steps-2;step++){const center=.12+.64*step/(g.steps-2),eps=1e-6;if(Math.abs(referenceClimbFraction(g,center-eps,reference)-referenceClimbFraction(g,center+eps,reference))<.01)continue;
  const shifts=[];for(const e of [1e-4,1e-6]){sample(actor,id,action,g,spec,center-e);const before=vertices(list.all);sample(actor,id,action,g,spec,center+e);const after=vertices(list.all);shifts.push(maxShift(before,after));}
  // The sole target runs at a measured .65m/s plus a bounded step arc.
  // The comparison also rejects a fixed jump at the phase boundary.
  assert.ok(shifts[1]<shifts[0]*.0103+1e-5,`${center}: all weighted visible surfaces shrink with the time interval`);
  assert.ok(shifts[1]/(2*eps*duration)<8,`${center}: body/contact speed remains within the original approach/fade bound`);
  edges.push({center,coarseMm:shifts[0]*1000,fineMm:shifts[1]*1000,speed:shifts[1]/(2*eps*duration)});
 }
 assert.ok(edges.length>0);results.push({id,lod,action,height:H,vertices:list.all.length,edges});actor.dispose();
});
for(const id of ['friar','woman-shawl','royalist','worker','surgeon','gaucho'])for(const lod of [0,1,2])test(`${id} LOD${lod}: complete visible clothing and headwear retain the tall-wrap continuity`,async()=>{
 const source=await asset(id,lod),spec=source.clips.find(s=>s.name==='life.climbUp'),g=ladderGeometry([0,1.2,0],[0,6.8,TILE_METRES],TILE_METRES),actor=new ActorRuntime(source,visual(id,'climbUp',{cue:undefined})),list=surface(actor),center=.12+.64*15/(g.steps-2),eps=1e-6;
 sample(actor,id,'climbUp',g,spec,center-eps);const before=vertices(list.all);sample(actor,id,'climbUp',g,spec,center+eps);const after=vertices(list.all);assert.ok(maxShift(before,after)<8*2*eps*5.6/.65,'All visible wardrobe skin, not only support proxies');results.push({id,lod,action:'climbUp',height:5.6,vertices:list.all.length,wardrobeWrapMm:maxShift(before,after)*1000});actor.dispose();
});
for(const id of ['granadero','woman-scout'])test(`${id}: native reference, exact clocks and inactive routes stay unchanged`,async()=>{
 const source=await asset(id),spec=source.clips.find(s=>s.name==='life.climbUp'),g=ladderGeometry([0,.4,0],[0,3.4,TILE_METRES],TILE_METRES),actor=new ActorRuntime(source,visual(id,'climbUp',{cue:undefined})),native=new ActorRuntime(source,visual(id,'climbUp',{cue:undefined}));native.climbFit.apply=()=>{};
 for(const up of [0,.03,.08,.12,.3,.5,.7,.76,.85,.91,.98,1]){sample(actor,id,'climbUp',g,spec,up,.0167);sample(native,id,'climbUp',g,spec,up,.0167);assert.deepEqual(snapshot(actor),snapshot(native));assert.deepEqual(actor.root.position.toArray(),native.root.position.toArray());assert.equal(actor.action.time,native.action.time);assert.equal(actor.mixer.time,native.mixer.time);}
 for(const action of ['idle','walk','heal','pickup','free','climbUp']){actor.update(visual(id,action,{cue:undefined}),100);native.update(visual(id,action,{cue:undefined}),100);actor.tick(.0167,100);native.tick(.0167,100);assert.deepEqual(snapshot(actor),snapshot(native),action+' without a paid climb geometry stays exact');}
 actor.dispose();native.dispose();
});

for(const id of ['granadero','woman-scout'])for(const action of ['climbUp','climbDown'])test(`${id} ${action}: held and late first paid frames keep support, exact clock and restored raw input`,async()=>{
 const source=await asset(id),spec=source.clips.find(s=>s.name==='life.'+action),g=ladderGeometry([0,1.2,0],[0,6.8,TILE_METRES],TILE_METRES);
 for(const delay of [0,1/60,1/30]){
  const actor=new ActorRuntime(source,visual(id,'idle',{cue:undefined})),fraction=action==='climbDown'?1-delay/(5.6/.65):delay/(5.6/.65);sample(actor,id,action,g,spec,fraction,delay);
  const savedPosition=actor.root.position.toArray(),mapped=actor.climbFit.nativeFraction(g,fraction,spec),clock=actor.action.getClip().duration*(action==='climbDown'?1-mapped:mapped);
  assert.equal(actor.action.time,clock);assert.equal(actor.action.timeScale,0);assert.deepEqual(actor.root.position.toArray(),savedPosition);
  // Advance the mix to complete the native approach, then hold the same paid frame.
  for(let i=0;i<12;i++)sample(actor,id,action,g,spec,fraction,1/60);
  const before=snapshot(actor),skin=vertices(surface(actor).all);for(let i=0;i<20;i++)actor.tick(1/60,1000);
  assert.deepEqual(snapshot(actor),before,'Held paid phase cannot accumulate fit rotations/body displacement');actor.root.updateMatrixWorld(true);assert.ok(maxShift(skin,vertices(surface(actor).all))<1e-8,'Complete held weighted body/garment surface');assert.equal(actor.action.time,clock);assert.deepEqual(actor.root.position.toArray(),savedPosition);
  for(const up of [.3,.653,.6537,.8,.93]){sample(actor,id,action,g,spec,up,.0167);actor.climbFit.restore();const raw=snapshot(actor);actor.climbFit.restore();assert.deepEqual(snapshot(actor),raw,'Restore is idempotent');actor.root.updateMatrixWorld(true);actor.model.traverse(n=>{if(n.isBone)assert.ok(n.matrixWorld.elements.every(Number.isFinite));});}
  actor.dispose();
 }
});

for(const id of ['granadero','woman-scout'])for(const lod of [0,1,2])for(const action of ['climbUp','climbDown'])test(`${id} LOD${lod} ${action}: source-pole fades and analytic contact edges retain full surface continuity`,async()=>{
 const source=await asset(id,lod),spec=source.clips.find(s=>s.name==='life.'+action);
 for(const H of [2,4.2,5.6]){const g=ladderGeometry([0,.9,0],[0,.9+H,TILE_METRES],TILE_METRES),actor=new ActorRuntime(source,visual(id,action,{cue:undefined})),list=surface(actor).all;
  for(const center of [.02,.12,.76-.32/(g.steps-2),.91,1]){const shifts=[];for(const eps of [1e-4,1e-6]){sample(actor,id,action,g,spec,center-eps);const a=vertices(list);sample(actor,id,action,g,spec,center+eps);const b=vertices(list);shifts.push(maxShift(a,b));}assert.ok(shifts[1]<shifts[0]*.0103+1e-5,`${H}m ${center}: no fixed surface jump at a source fade/contact edge`);}
  actor.dispose();
 }
});

for(const id of ['granadero','woman-scout'])test(`${id}: missing or non-finite native body tracks retain the bounded limb fallback`,async()=>{
 const source=await asset(id),spec=source.clips.find(s=>s.name==='life.climbUp'),g=ladderGeometry([0,1.2,0],[0,6.8,TILE_METRES],TILE_METRES),actor=new ActorRuntime(source,visual(id,'climbUp',{cue:undefined}));sample(actor,id,'climbUp',g,spec,.65);actor.climbFit.restore();const before=snapshot(actor),clip=actor.action.getClip();
 const invalid=[undefined,clip.clone(),clip.clone(),clip.clone()];invalid[1].tracks=invalid[1].tracks.filter(t=>t.name!=='spine_03.quaternion');invalid[2].tracks.find(t=>t.name==='Root.position').values[0]=NaN;invalid[3].duration=NaN;
 for(const current of invalid){actor.climbFit.apply(g,.65,spec,current);const after=snapshot(actor);for(const [name,bone]of Object.entries(after)){assert.deepEqual(bone.p,before[name].p,name+' fallback native offset');assert.deepEqual(bone.s,before[name].s,name+' fallback native dimensions');if(!/^(thigh|calf|foot|upperarm|lowerarm|hand)_[lr]$/.test(name))assert.deepEqual(bone.q,before[name].q,name+' keeps its raw native channel');}actor.root.updateMatrixWorld(true);actor.model.traverse(n=>{if(n.isBone)assert.ok(n.matrixWorld.elements.every(Number.isFinite));});actor.climbFit.restore();}
 actor.dispose();
});

for(const id of ['granadero','woman-scout'])for(const lod of [0,1,2])test(`${id} LOD${lod}: real owned equipment and overlay garments remain joined at the rung wrap`,async()=>{
 const source=await asset(id,lod),spec=source.clips.find(s=>s.name==='life.climbUp'),g=ladderGeometry([0,1.2,0],[0,6.8,TILE_METRES],TILE_METRES),center=.12+.64*15/(g.steps-2),eps=1e-6;
 for(const [item,equipment,socket]of [['1800','long-gun','handRight'],['1805','short-gun','handLeft'],['1809','blade','handRight'],['1812','blade','handRight'],['medkits','unarmed','handRight']]){
  const extra={equipment,items:[{id:item,reference:'owned:'+item,socket}],garments:{headwear:'hat',outfit:'poncho',legwear:'trousers'}},actor=new ActorRuntime(source,visual(id,'climbUp',{cue:undefined,...extra}));
  sample(actor,id,'climbUp',g,spec,center-eps,0,extra);const list=surface(actor).all,items=list.filter(({mesh})=>{for(let n=mesh;n;n=n.parent)if(n.userData.itemId===item)return true;return false;});assert.ok(items.length>20,'Actual published equipment surface');const before=vertices(list),itemBefore=vertices(items);
  sample(actor,id,'climbUp',g,spec,center+eps,0,extra);const after=vertices(list),itemAfter=vertices(items);assert.ok(maxShift(before,after)<8*2*eps*5.6/.65,'All worn overlay, native and item vertices');assert.ok(maxShift(itemBefore,itemAfter)<8*2*eps*5.6/.65,'Actual held/stowed item joins');assert.deepEqual(actor.visual.items,extra.items,'Fitting cannot mutate owned items');actor.dispose();
 }
});
test('current native animation banks, complete body LODs and garments provide complete published input hashes and validate declared banks',()=>{
 const sources=[...Object.values(manifest.animationLibraries),...Object.values(manifest.appearances).flatMap(a=>a.lods),...Object.values(manifest.garments)];
 const pins=[];for(const source of sources){const bytes=readFileSync(new URL(`../web/public${source.url}`,import.meta.url)),hash=createHash('sha256').update(bytes).digest('hex');if(source.sha256)assert.equal(hash,source.sha256,source.url+' is the actual declared native input');pins.push({url:source.url,sha256:hash});}writeFileSync('artifacts/climb-phase-input-pins.json',JSON.stringify(pins,null,2)+'\n');
});
test.after(()=>{mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/climb-phase-continuity.json',JSON.stringify({results},null,2)+'\n');});
