import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Vector3,Plane,Raycaster,DoubleSide} from '../web/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');
const libraryRoot=process.env.GRANADEROS_CHARACTER_LIBRARY?pathToFileURL(resolve(process.env.GRANADEROS_CHARACTER_LIBRARY)+sep):new URL('../web/public/models/characters/',import.meta.url);
const libraryAsset=url=>{assert.ok(url.startsWith('/models/characters/'));return new URL(url.slice('/models/characters/'.length),libraryRoot);};
const manifest=JSON.parse(readFileSync(new URL('manifest.json',libraryRoot))),loaded=new Map();
function load(url){
 if(loaded.has(url))return loaded.get(url);
 // Keep published buffers, rig, and animation tracks. Browser image decoding
 // is not required for CPU contact checks on the actual skinned geometry.
 const bytes=readFileSync(libraryAsset(url)),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
 delete doc.images;delete doc.textures;delete doc.samplers;doc.materials=(doc.materials??[]).map(material=>({name:material.name}));
 const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),binary=bytes.subarray(20+length),header=Buffer.from(bytes.subarray(0,20));
 header.writeUInt32LE(20+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);
 const buffer=Buffer.concat([header,padded,binary]),promise=new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.length),'');loaded.set(url,promise);return promise;
}
async function asset(id){
 const appearance=manifest.appearances[id],library=manifest.animationLibraries[appearance.gender];
 const [body,animation,equipment,horse]=await Promise.all([load(appearance.lods[1].url),load(library.url),load(manifest.equipment.url),load(manifest.horse.lods[1].url)]);
 return {manifest,appearance,body,animation,equipment,horse,clips:library.clips,lod:1};
}
function visual(id,action,extra={}){
 const mounted=action!=='dismount';
 return {key:`unit:${id}`,id,kind:'unit',appearance:id,skin:'light',side:'player',tacticalLevel:0,position:[4,0,7],yaw:0,posture:'standing',mounted,action,idleAction:'idle',equipment:'unarmed',items:[],garments:{headwear:null,outfit:null,legwear:null},selected:false,bodyHeights:{},cue:{id:`${id}:${action}`,action,startedAt:0,fromPosture:mounted?'standing':'mounted'},...extra};
}
function point(actor,name){actor.root.updateMatrixWorld(true);return actor.root.worldToLocal(actor.model.getObjectByName(name).getWorldPosition(new Vector3()));}
function closeVector(actual,expected,tolerance,message){assert.ok(actual.distanceTo(new Vector3(...expected))<tolerance,`${message}: ${actual.toArray()} != ${expected}`);}
function contactPlane(actor,side){
 const mesh=actor.model.getObjectByName('Human_footwear_LOD1'),position=mesh.geometry.attributes.position,points=[];
 mesh.skeleton.update();
 // The native sole is open on the underside. Sample its actual lower ring
 // rather than treating the low heel as the supported ball of the foot.
 for(let index=0;index<position.count;index++){
  if(Math.abs(position.getY(index)-.007)>.0002||(position.getX(index)>0)!==(side==='l'))continue;
  const point=actor.root.worldToLocal(mesh.getVertexPosition(index,new Vector3()).applyMatrix4(mesh.matrixWorld));
  if(!points.some(other=>other.distanceTo(point)<.0001))points.push(point);
 }
 assert.ok(points.length>=3,'The published footwear retains a native sole contact ring');
 return new Plane().setFromCoplanarPoints(points[0],points[Math.floor(points.length/3)],points[Math.floor(points.length*2/3)]);
}
function ironTarget(actor,source,side){
 const horse=actor.root.children.find(node=>node!==actor.model),rest=source.horse.scene,body=horse.getObjectByName('horse_body'),native=rest.getObjectByName('horse_body');
 rest.updateMatrixWorld(true);
 const irons=[];rest.traverse(node=>{if(node.isMesh&&node.name.startsWith('Iron_Stirrup'))irons.push(node);});
 const iron=irons.find(node=>{node.geometry.computeBoundingBox();return (node.geometry.boundingBox.getCenter(new Vector3()).x>0)===(side==='l');});assert.ok(iron);
 const position=iron.geometry.attributes.position,centre=new Vector3();let low=Infinity;iron.skeleton.update();
 for(let index=0;index<position.count;index++){const point=rest.worldToLocal(iron.getVertexPosition(index,new Vector3()).applyMatrix4(iron.matrixWorld));centre.add(point);low=Math.min(low,point.y);}
 centre.divideScalar(position.count);centre.y=low+.010;
 const seat=rest.getObjectByName(source.manifest.horse.saddle.node).getWorldPosition(new Vector3()),anchor=new Vector3(...source.manifest.horse.saddle.position).sub(seat);
 closeVector(new Vector3(...actor.clipSpec.ridingSupport.stirrups[side]),centre.clone().add(anchor).toArray(),.001,'The rider uses the actual published iron geometry');
 return actor.root.worldToLocal(body.localToWorld(native.worldToLocal(centre)));
}
for(const appearance of ['granadero','woman-scout'])test(`${appearance} supports both riding boots on the moving stirrups`,async()=>{
 const source=await asset(appearance);
 for(const [id,equipment]of [['1800','long-gun'],['1812','blade']])for(const action of equipment==='blade'?['idle','walk','run','brace']:['idle','walk','run','aim','fire','reload','brace']){
  const actor=new ActorRuntime(source,visual(appearance,action,{posture:'mounted',mounted:true,equipment,items:[{id,reference:'primary',socket:'handRight'}],cue:['idle','walk','run'].includes(action)?undefined:{id:`riding:${action}`,action,startedAt:0}}));
  for(let step=0;step<6;step++){
   actor.tick(.1,step*100);actor.root.updateMatrixWorld(true);
   for(const side of ['l','r']){
    const plane=contactPlane(actor,side),target=ironTarget(actor,source,side),gap=Math.abs(plane.distanceToPoint(target));
    assert.ok(gap<.007,`${id} ${action} ${side} sole reaches the moving iron: ${(gap*1000).toFixed(2)} mm`);
    assert.ok(Math.abs(plane.normal.y)>.97,'The boot has a small heel drop');
    // A near-horizontal plane alone could still lie outside the boot.
    const mesh=actor.model.getObjectByName('Human_footwear_LOD1');mesh.material.side=DoubleSide;
    const ray=new Raycaster(actor.root.localToWorld(target.clone().add(new Vector3(0,.035,0))),new Vector3(0,-1,0),0,.07);
    assert.ok(ray.intersectObject(mesh).length,'The supported ball of the boot spans the iron in plan');
   }
   closeVector(actor.root.position,[4,0,7],1e-8,'Riding support leaves the saved gameplay position intact');
  }
  actor.dispose();
 }
});
for(const appearance of ['granadero','woman-scout'])test(`${appearance} mount endpoints keep the supported riding leg pose`,async()=>{
 const source=await asset(appearance),riding=new ActorRuntime(source,visual(appearance,'idle',{posture:'mounted',mounted:true,cue:undefined})),mount=new ActorRuntime(source,visual(appearance,'mount')),dismount=new ActorRuntime(source,visual(appearance,'dismount'));
 riding.tick(0,0);mount.tick(0,source.clips.find(clip=>clip.name==='life.mount').duration*1000*.98);dismount.tick(0,0);
 for(const bone of ['thigh_l','thigh_r','calf_l','calf_r','foot_l','foot_r','ball_l','ball_r'])for(const actor of [mount,dismount])closeVector(point(actor,bone),point(riding,bone).toArray(),.006,`${bone} has no jump at the riding endpoint`);
 for(const actor of [riding,mount,dismount])actor.dispose();
});
