import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
const base=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const {asset,visual,surface,vertices,sample}=await import(pathToFileURL(base+'/tests/helpers/climb-native-fixture.mjs'));
const {predecessorActor}=await import(pathToFileURL(base+'/tests/helpers/climb-crest-predecessor.mjs'));
const {ActorRuntime}=await import(pathToFileURL(base+'/web/lib/three/actor-runtime.ts'));
const {TILE_METRES}=await import(pathToFileURL(base+'/web/lib/three/projection.ts'));
const {ladderGeometry}=await import(pathToFileURL(base+'/game/climb-geometry.js'));
const id='granadero',lod=1,action='climbUp',H=2,center=.784,eps=1e-6,source=await asset(id,lod),spec=source.clips.find(s=>s.name==='life.'+action),g=ladderGeometry([0,1.2,0],[0,1.2+H,TILE_METRES],TILE_METRES),paidDuration=Math.max(spec.duration,H/.65),records={};
for(const[label,actor]of [['before',predecessorActor(source,id,action)],['current',new ActorRuntime(source,visual(id,action,{cue:undefined}))]]){
 const list=surface(actor).all;sample(actor,id,action,g,spec,center-eps);const a=vertices(list);sample(actor,id,action,g,spec,center+eps);const b=vertices(list);let max=0,index=-1;
 for(let i=0;i<a.length;i++){const d=a[i].distanceTo(b[i]);if(d>max){max=d;index=i;}}
 records[label]={fullSurfaceSpeedMps:max/(2*eps*paidDuration),mesh:list[index].mesh.name,vertex:list[index].index,beforeWorld:a[index].toArray(),afterWorld:b[index].toArray(),decodedDuration:actor.action.getClip().duration,centerNativeTime:actor.action.getClip().duration*actor.climbFit.nativeFraction(g,center,spec),centerPaidFraction:center};actor.dispose();
}
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
writeFileSync(base+'/artifacts/crest-retained-136mps-witness.json',JSON.stringify({id,lod,action,height:H,span:TILE_METRES,steps:g.steps,centerPaidFraction:center,paidDurationSeconds:paidDuration,epsilon:eps,records,sourcePins:{beforeHelper:sha(base+'/docs/art/reviews/climb-crest-phase/before-climb-contact-fit.ts.txt'),beforeGeometry:sha(base+'/docs/art/reviews/climb-crest-phase/before-climb-geometry.js.txt'),currentHelper:sha(base+'/web/lib/three/climb-contact-fit.ts'),currentGeometry:sha(base+'/game/climb-geometry.js')},scope:'Actual full weighted surface pace witness. Removal of fixed crest jumps does not constitute natural-motion acceptance.'},null,2)+'\n');console.log(records);
