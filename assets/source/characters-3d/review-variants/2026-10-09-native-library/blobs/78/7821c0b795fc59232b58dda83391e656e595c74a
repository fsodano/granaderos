import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Box3,LoopOnce,Ray,Triangle,Vector3} from '../web/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');

const directory=process.env.GRANADEROS_CHARACTER_LIBRARY
 ?pathToFileURL(resolve(process.env.GRANADEROS_CHARACTER_LIBRARY)+sep)
 :new URL('../web/public/models/characters/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',directory)));
const directions=[[1,.173,.311],[-1,.237,.131],[.217,1,.413],[.367,-1,.113],[.113,.233,1],[.431,.157,-1]].map(v=>new Vector3(...v).normalize());

const loaded=new Map();
async function load(url){
 if(loaded.has(url))return loaded.get(url);
 assert.ok(url.startsWith('/models/characters/'));
 const bytes=readFileSync(new URL(url.slice('/models/characters/'.length),directory)),size=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+size));
 // Keep exported skin weights, geometry and animation. Only image decoding
 // is omitted from this CPU geometry test.
 delete doc.images;delete doc.textures;delete doc.samplers;doc.materials=(doc.materials??[]).map(({name})=>({name}));
 const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),binary=bytes.subarray(20+size),header=Buffer.from(bytes.subarray(0,20));
 header.writeUInt32LE(20+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);
 const buffer=Buffer.concat([header,padded,binary]),result=new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.length),'');loaded.set(url,result);return result;
}

function surface(triangles){
 function build(items){
  const box=new Box3();for(const triangle of items)box.expandByPoint(triangle.a).expandByPoint(triangle.b).expandByPoint(triangle.c);
  if(items.length<=12)return {box,triangles:items};
  const extent=box.getSize(new Vector3()),axis=extent.x>extent.y?(extent.x>extent.z?'x':'z'):(extent.y>extent.z?'y':'z');
  items.sort((a,b)=>(a.a[axis]+a.b[axis]+a.c[axis])-(b.a[axis]+b.b[axis]+b.c[axis]));const middle=items.length>>1;
  return {box,left:build(items.slice(0,middle)),right:build(items.slice(middle))};
 }
 assert.ok(triangles.length>0);const tree=build(triangles),scratch=new Vector3();
 function inside(point){
  // Bounds and multiple ray directions distinguish true penetration from
  // the exterior side of a nearby surface. A nearest normal is insufficient.
  if(!tree.box.containsPoint(point))return false;
  let votes=0;
  for(const direction of directions){
   const ray=new Ray(point,direction),hits=[];
   function visit(node){
    if(!ray.intersectBox(node.box,scratch))return;
    if(node.triangles){for(const t of node.triangles){const hit=ray.intersectTriangle(t.a,t.b,t.c,false,scratch);if(hit)hits.push(hit.distanceTo(point));}}
    else{visit(node.left);visit(node.right);}
   }
   visit(tree);hits.sort((a,b)=>a-b);let count=0,last=-Infinity;
   for(const distance of hits)if(distance-last>1e-6){count++;last=distance;}
   votes+=count%2;
  }
  return votes>=4;
 }
 function depth(point){
  if(!inside(point))return 0;let nearest=Infinity;
  function visit(node){
   if(node.box.distanceToPoint(point)>=nearest)return;
   if(node.triangles){for(const t of node.triangles)nearest=Math.min(nearest,t.closestPointToPoint(point,scratch).distanceTo(point));}
   else{visit(node.left);visit(node.right);}
  }
  visit(tree);return nearest;
 }
 return {inside,depth};
}

function posed(mesh){mesh.skeleton.update();return Array.from({length:mesh.geometry.attributes.position.count},(_,index)=>mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld));}
function triangles(mesh){const points=posed(mesh),index=mesh.geometry.index;return Array.from({length:index.count/3},(_,face)=>new Triangle(...[0,1,2].map(corner=>points[index.getX(face*3+corner)])));}
function dominant(mesh){const a=mesh.geometry.attributes;return Array.from({length:a.skinIndex.count},(_,index)=>{let slot=0;for(let k=1;k<4;k++)if(a.skinWeight.getComponent(index,k)>a.skinWeight.getComponent(index,slot))slot=k;return mesh.skeleton.bones[a.skinIndex.getComponent(index,slot)].name;});}
async function asset(preset,lod){const appearance=manifest.appearances[preset],bank=manifest.animationLibraries[appearance.animationLibrary];const [body,animation,equipment,horse]=await Promise.all([load(appearance.lods[lod].url),load(bank.url),load(manifest.equipment.url),load(manifest.horse.lods[lod].url)]);return {manifest,appearance,body,animation,equipment,horse,clips:bank.clips,lod};}
function actorFor(source,preset,spec,item=null){
 const gait=['walk','run'].includes(spec.gesture)?spec.gesture:'idle';
 const visual={key:`unit:${preset}`,id:preset,kind:'unit',appearance:preset,skin:'light',side:'player',tacticalLevel:0,position:[0,0,0],yaw:0,posture:'mounted',mounted:true,action:gait,idleAction:'idle',equipment:item?(['knife','lance'].includes(spec.equipment)?'blade':spec.equipment):'unarmed',items:item?[{id:item,reference:'primary',socket:'handRight'}]:[],garments:{headwear:null,outfit:null,legwear:null},selected:false,bodyHeights:{}};
 const actor=new ActorRuntime(source,visual);
 // Select every exported mounted variant, including item-specific reloads.
 // Placement, horse gait, skeletal deformation and cloth still use runtime.
 actor.mixer.stopAllAction();actor.action=actor.mixer.clipAction(source.animation.animations.find(clip=>clip.name===spec.name)).setLoop(LoopOnce,1);actor.action.clampWhenFinished=true;actor.action.play();actor.clipSpec=spec;actor.seatActions.clear();actor.seatActions.set(actor.action,{spec,mounted:true});
 return actor;
}
function sample(actor,fraction){actor.action.time=actor.action.getClip().duration*fraction;if(actor.horseAction)actor.horseAction.time=actor.horseAction.getClip().duration*fraction;actor.tick(0,actor.action.time*1000);actor.root.updateMatrixWorld(true);}
function horseSurface(actor){const root=actor.root.children.find(node=>node!==actor.model),body=root.getObjectByName('Horse_Body'),faces=[];body.traverse(mesh=>{if(mesh.isSkinnedMesh)faces.push(...triangles(mesh));});return {root,surface:surface(faces)};}
const departed=new Set(['mount','dismount','die','collapse','dead','unconscious','recover','knockdown']);
for(const preset of ['granadero','woman-scout'])for(const lod of [0,1,2])test(`${preset} LOD${lod} seated cloth and boots stay outside the moving horse`,async context=>{
 const source=await asset(preset,lod),filter=process.env.GRANADEROS_RIDER_CLIPS?.split(',');
 const specs=source.clips.filter(spec=>spec.posture==='mounted'&&!departed.has(spec.gesture)&&(lod===0||['idle','walk','run'].includes(spec.gesture)&&spec.equipment==='unarmed')&&(!filter||filter.includes(spec.gesture)));
 assert.ok(specs.length);let maximum={depth:0},samples=0;
 for(const spec of specs){
  const actor=actorFor(source,preset,spec),meshes=[];actor.model.traverse(mesh=>{if(mesh.isSkinnedMesh&&/^Human_(legwear|footwear)/.test(mesh.name))meshes.push(mesh);});
  for(const fraction of (['walk','run'].includes(spec.gesture)?[0,.125,.25,.375,.5,.625,.75,.875]:[0,.25,.5,.75])){
   sample(actor,fraction);const target=horseSurface(actor).surface;
   for(const mesh of meshes)for(const point of posed(mesh)){const depth=target.depth(point);if(depth>maximum.depth)maximum={depth,clip:spec.name,fraction,mesh:mesh.name,point:point.toArray()};}
   samples++;
  }
  actor.dispose();
 }
 context.diagnostic(JSON.stringify({samples,maximum}));assert.ok(maximum.depth<.003,`Actual riding cloth penetrates horse: ${JSON.stringify(maximum)}`);
});
for(const preset of ['granadero','woman-scout'])test(`${preset} rests its clothed seat on the actual saddle surface`,async context=>{
 for(const lod of [0,1,2]){
  const source=await asset(preset,lod),spec=source.clips.find(s=>s.name==='mounted.idle.unarmed'),actor=actorFor(source,preset,spec);sample(actor,0);
  const {root}=horseSurface(actor),faces=[];root.getObjectByName('Saddle').traverse(mesh=>{if(mesh.isSkinnedMesh)faces.push(...triangles(mesh));});assert.ok(faces.length);let minimum=Infinity;
  actor.model.traverse(mesh=>{if(!mesh.isSkinnedMesh||!mesh.name.startsWith('Human_legwear'))return;const names=dominant(mesh),points=posed(mesh),hit=new Vector3();for(let i=0;i<points.length;i++){if(names[i]!=='pelvis')continue;const ray=new Ray(points[i].clone().add(new Vector3(0,1,0)),new Vector3(0,-1,0));for(const face of faces)if(ray.intersectTriangle(face.a,face.b,face.c,false,hit))minimum=Math.min(minimum,points[i].y-hit.y);}});
  context.diagnostic(JSON.stringify({lod,minimumSeatGap:minimum}));assert.ok(minimum>-.004&&minimum<.018,`LOD${lod} clothed seat gap ${minimum} m`);actor.dispose();
 }
});
for(const lod of [0,1,2])test(`horse LOD${lod} stirrup irons and leathers clear its native moving barrel`,async context=>{
 const source=await asset('granadero',lod);let maximum={depth:0};
 for(const gait of ['idle','walk','run']){
  const actor=actorFor(source,'granadero',source.clips.find(s=>s.name===`mounted.${gait}.unarmed`));
  for(const fraction of [0,.125,.25,.375,.5,.625,.75,.875]){sample(actor,fraction);const {root,surface}=horseSurface(actor);root.traverse(mesh=>{if(!mesh.isSkinnedMesh||!/^(Iron_Stirrup|Stirrup_Leather)/.test(mesh.name))return;for(const point of posed(mesh)){const depth=surface.depth(point);if(depth>maximum.depth)maximum={depth,gait,fraction,mesh:mesh.name};}});}
  actor.dispose();
 }
 context.diagnostic(JSON.stringify(maximum));assert.ok(maximum.depth<.002,`Actual stirrup tack penetrates the barrel: ${JSON.stringify(maximum)}`);
});

for(const preset of ['granadero','woman-scout'])test(`${preset} mounted falls clear the horse and hand off to the actual prone destination`,async context=>{
 const source=await asset(preset,0),names=['pelvis','head','hand_l','hand_r','foot_l','foot_r'];let deepest=0,lowest=Infinity;
 for(const [gesture,destination] of [['die','life.prone.dead'],['collapse','life.prone.unconscious'],['knockdown','prone.idle.unarmed']]){
  const spec=source.clips.find(s=>s.name===`life.mounted.${gesture}`),actor=actorFor(source,preset,spec),meshes=[];
  actor.model.traverse(mesh=>{if(mesh.isSkinnedMesh&&/^Human_(skin|legwear|footwear)/i.test(mesh.name))meshes.push(mesh);});
  for(let frame=0;frame<=80;frame++){
   sample(actor,frame/80);const {root,surface:horse}=horseSurface(actor);
   for(const mesh of meshes)for(const point of posed(mesh)){
    if(root.visible)deepest=Math.max(deepest,horse.depth(point));
    if(/^Human_(skin|footwear)/i.test(mesh.name))lowest=Math.min(lowest,point.y);
   }
  }
  assert.equal(horseSurface(actor).root.visible,false,'The released horse is absent at ground handoff');
  const rest=actorFor(source,preset,source.clips.find(s=>s.name===destination));sample(rest,0);
  for(const name of names){const a=actor.model.getObjectByName(name).getWorldPosition(new Vector3()),b=rest.model.getObjectByName(name).getWorldPosition(new Vector3());assert.ok(a.distanceTo(b)<.001,`${gesture} ${name} disagrees with ${destination} by ${a.distanceTo(b)} m`);}
  rest.dispose();actor.dispose();
 }
 context.diagnostic(JSON.stringify({deepest,lowest}));assert.ok(deepest<.003,'The departing rider intersects the visible horse');assert.ok(lowest>-.003,'Actual boot or skin enters the floor during the fall');
});
for(const preset of ['granadero','woman-scout'])test(`${preset} mounted recovery follows the unmounted ground contract`,async()=>{
 const source=await asset(preset,0),spec=source.clips.find(s=>s.name==='life.mounted.recover'),actor=actorFor(source,preset,spec),ground=actorFor(source,preset,source.clips.find(s=>s.name==='life.prone.recover'));
 for(const fraction of [0,.25,.5,.75,1]){
  sample(actor,fraction);sample(ground,fraction);assert.equal(horseSurface(actor).root.visible,false);
  for(const name of ['pelvis','head','hand_l','hand_r','foot_l','foot_r']){
   const a=actor.model.getObjectByName(name).getWorldPosition(new Vector3()),b=ground.model.getObjectByName(name).getWorldPosition(new Vector3());assert.ok(a.distanceTo(b)<.002,`Ground recovery diverges at ${fraction}: ${name}`);
  }
 }
 actor.dispose();ground.dispose();
});

for(const preset of ['granadero','woman-scout'])test(`${preset} mounted sabre, knife and lance stay outside the horse`,async context=>{
 const source=await asset(preset,0),items={blade:'1809',knife:'1813',lance:'1812'};let maximum={depth:0};
 for(const spec of source.clips.filter(s=>s.posture==='mounted'&&items[s.equipment])){
  const actor=actorFor(source,preset,spec,items[spec.equipment]),object=actor.model.getObjectByName('primary:'+items[spec.equipment]);assert.ok(object);
  for(let frame=0;frame<=24;frame++){
   const fraction=frame/24;sample(actor,fraction);const target=horseSurface(actor).surface;
   object.traverse(mesh=>{if(!mesh.isMesh)return;for(let i=0;i<mesh.geometry.attributes.position.count;i++){
    const point=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld),depth=target.depth(point);
    if(depth>maximum.depth)maximum={depth,clip:spec.name,fraction,mesh:mesh.name};
   }});
  }
  actor.dispose();
 }
 context.diagnostic(JSON.stringify(maximum));assert.ok(maximum.depth<.002,`Held weapon intersects horse: ${JSON.stringify(maximum)}`);
});
