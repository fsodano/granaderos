import {BoxGeometry,ConeGeometry,CylinderGeometry,DoubleSide,Group,IcosahedronGeometry,Mesh,MeshBasicMaterial,MeshStandardMaterial,Quaternion,RingGeometry,Vector3} from 'three';
import type {BufferGeometry,Material,Object3D,Scene} from 'three';
import {firearmFlightDuration} from '../../../game/battle-playback.js';

/** Positions use grid X/Y and an absolute metric height. No battle state crosses this boundary. */
export type EffectPoint={x:number;y:number;height:number;tacticalLevel?:number;fraction?:number};
export type EffectLanding={x:number;y:number;elevation:number;tacticalLevel?:number};
export type EffectImpact=EffectPoint&{outcome?:'hit'|'cover'|'miss'|null;material?:string};
export type GrenadeEffectVisual={visible:boolean;source:EffectPoint;impact:EffectPoint;landing:EffectLanding;points:readonly EffectPoint[];radius:number;detonated:boolean;contacts?:readonly EffectPoint[]};
export type KnifeEffectVisual={visible:boolean;source:EffectPoint;impact:EffectPoint;weapon?:number;landing?:EffectLanding};
export type FirearmEffectVisual={visible:boolean;source:EffectPoint;impact:EffectPoint;outcome:'hit'|'cover'|'miss'|'pellets'|null;material?:string;spread?:boolean;discharge?:boolean;shotHand?:'primary'|'offhand';shotId?:string|number};
export type ArtilleryEffectVisual={visible:boolean;source:EffectPoint;impact?:EffectPoint;points?:readonly EffectPoint[];impacts?:readonly EffectImpact[];canister?:boolean;discharge?:boolean;cannonId?:string};
type TimedEvent={id:string;startedAtSeconds:number;durationSeconds?:number;dischargeAnchor?:EffectPoint;actorKey?:string;cannonId?:string};
export type CombatEffectEvent=TimedEvent&(
  {kind:'grenade';visual:GrenadeEffectVisual;stage?:'effect'}|
  {kind:'knife';visual:KnifeEffectVisual;stage?:'effect'}|
  {kind:'firearm';visual:FirearmEffectVisual;stage:'projectile'|'impact'}|
  {kind:'artillery';visual:ArtilleryEffectVisual;stage?:'projectile'|'impact'|'effect'}
);
export type CombatEffectsInput={events?:readonly CombatEffectEvent[];timeSeconds?:number;reducedMotion?:boolean};
export type CombatEffectsOptions={tileMetres:number};
type AnimatedPart={mesh:Object3D;draw:(elapsed:number,reduced:boolean)=>void};
type Entry={event:CombatEffectEvent;signature:string;group:Group;parts:AnimatedPart[];materials:Set<Material>;duration:number};
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const finitePoint=(point:any):point is EffectPoint=>Boolean(point)&&[point.x,point.y,point.height].every(Number.isFinite);
const finiteLanding=(point:any):point is EffectLanding=>Boolean(point)&&[point.x,point.y,point.elevation].every(Number.isFinite);
const validPoints=(points:any,min=0)=>Array.isArray(points)&&points.length>=min&&points.length<=256&&points.every(finitePoint);
function validEvent(event:any):event is CombatEffectEvent{
  if(!event||typeof event.id!=='string'||!event.id||!Number.isFinite(event.startedAtSeconds)||event.startedAtSeconds<0||!event.visual?.visible)return false;
  if(event.durationSeconds!==undefined&&(!Number.isFinite(event.durationSeconds)||event.durationSeconds<.02||event.durationSeconds>60))return false;
  if(event.dischargeAnchor!==undefined&&!finitePoint(event.dischargeAnchor))return false;
  const v=event.visual;if(!finitePoint(v.source))return false;
  if(event.kind==='grenade')return finitePoint(v.impact)&&finiteLanding(v.landing)&&validPoints(v.points,2)&&Number.isFinite(v.radius)&&v.radius>=0&&v.radius<=20&&typeof v.detonated==='boolean'&&(v.contacts===undefined||validPoints(v.contacts));
  if(event.kind==='knife')return finitePoint(v.impact);
  if(event.kind==='firearm')return finitePoint(v.impact)&&['projectile','impact'].includes(event.stage)&&[null,'hit','cover','miss','pellets'].includes(v.outcome);
  if(event.kind==='artillery')return ['projectile','impact','effect',undefined].includes(event.stage)&&(v.impact===undefined||finitePoint(v.impact))&&(v.points===undefined||validPoints(v.points,2))&&(v.impacts===undefined||(validPoints(v.impacts)&&v.impacts.length<=64));
  return false;
}
function eventDuration(event:CombatEffectEvent){return event.durationSeconds??(event.kind==='grenade'?1.2:event.kind==='knife'?.6:event.kind==='firearm'?(event.stage==='projectile'?firearmFlightDuration(event.visual)/1000:.65):1.2);}
function colourFor(impact:EffectImpact){return impact.outcome==='hit'?'#794d40':impact.material==='wood'?'#9b8060':['stone','brick'].includes(impact.material??'')?'#aaa79b':'#a89576';}
/** A private cosmetic stream. It does not call or mutate the simulation RNG. */
function randomFor(id:string){let state=2166136261;for(const char of id)state=Math.imul(state^char.charCodeAt(0),16777619);return()=>{state=(state+0x6d2b79f5)|0;let n=Math.imul(state^(state>>>15),1|state);n^=n+Math.imul(n^(n>>>7),61|n);return ((n^(n>>>14))>>>0)/4294967296;};}
function pathSampler(points:readonly EffectPoint[],T:number){
  const path=points.map(point=>new Vector3(point.x*T,point.height,point.y*T)),lengths=[0];
  for(let n=1;n<path.length;n++)lengths.push(lengths[n-1]+path[n].distanceTo(path[n-1]));
  const fractions=points.every((point,n)=>Number.isFinite(point.fraction)&&(!n||point.fraction!>=points[n-1].fraction!))&&points[0].fraction===0&&points.at(-1)!.fraction===1?points.map(point=>point.fraction!):lengths.map(length=>length/(lengths.at(-1)||1));
  return (fraction:number,target:Vector3)=>{const p=clamp(fraction);if(p<=0)return target.copy(path[0]);if(p>=1)return target.copy(path.at(-1)!);let n=1;while(n<fractions.length-1&&fractions[n]<p)n++;return target.copy(path[n-1]).lerp(path[n],(p-fractions[n-1])/(fractions[n]-fractions[n-1]||1));};
}

/** Draw only admitted records. Collision, trajectory solving and visibility belong to the game. */
export function createCombatEffects(scene:Scene,options:CombatEffectsOptions){
  const T=options.tileMetres;if(!Number.isFinite(T)||T<=0)throw Error('Combat effects require a positive tileMetres.');
  const root=new Group();root.name='combat-effects';scene.add(root);
  const geometries=new Map<string,BufferGeometry>(),entries=new Map<string,Entry>(),completed=new Map<string,string>();
  let time=0,reduced=false,disposed=false,rejected=0;
  const geometry=(kind:string)=>{let g=geometries.get(kind);if(!g){g=kind==='box'?new BoxGeometry(1,1,1):kind==='cone'?new ConeGeometry(1,1,7):kind==='cylinder'?new CylinderGeometry(1,1,1,8):kind==='ring'?new RingGeometry(.94,1,48):new IcosahedronGeometry(1,kind==='smoke'?1:0);geometries.set(kind,g);}return g;};
  function remove(id:string){const entry=entries.get(id);if(!entry)return;root.remove(entry.group);for(const material of entry.materials)material.dispose();entries.delete(id);}
  function create(event:CombatEffectEvent,signature:string):Entry{
    const group=new Group();group.name=`effect:${event.id}`;group.userData={id:event.id,kind:event.kind,stage:event.stage};root.add(group);
    const entry:Entry={event,signature,group,parts:[],materials:new Set(),duration:eventDuration(event)},rnd=randomFor(event.id);
    const at=(point:EffectPoint)=>new Vector3(point.x*T,point.height,point.y*T);
    const mesh=(name:string,kind:string,colour:string,basic=false,opacity=1)=>{const material=basic?new MeshBasicMaterial({color:colour,transparent:true,opacity,depthWrite:false,side:DoubleSide}):new MeshStandardMaterial({color:colour,roughness:.85,metalness:kind==='metal'?.55:0,transparent:true,opacity,depthWrite:false,flatShading:true});entry.materials.add(material);const object=new Mesh(geometry(kind),material);object.name=name;group.add(object);return object;};
    const add=(object:Object3D,draw:AnimatedPart['draw'])=>entry.parts.push({mesh:object,draw});
    const opacity=(object:Mesh,value:number)=>{(object.material as MeshBasicMaterial).opacity=clamp(value);};
    function smoke(point:EffectPoint,start:number,count:number,scale:number,colour='#6b6960',life=.65){
      for(let n=0;n<count;n++){const object=mesh(`smoke:${n}`,'smoke',colour),origin=at(point),angle=rnd()*Math.PI*2,rad=rnd()*scale*.5,lift=.4+rnd()*.7,size=scale*(.35+rnd()*.4);object.userData.role='smoke';add(object,(elapsed,quiet)=>{const age=elapsed-start,p=clamp(age/life);object.visible=age>=0&&age<life;object.position.copy(origin).add(new Vector3(Math.cos(angle)*rad*p,lift*p,Math.sin(angle)*rad*p));object.scale.setScalar(size*(1+p*.8));opacity(object,quiet?.16*(1-p):.46*Math.sin(Math.PI*p));});}
    }
    function discharge(point:EffectPoint,toward:EffectPoint|undefined,large=false){
      const flash=mesh('muzzle-flash','cone','#f2c777',true),origin=at(point),direction=toward?at(toward).sub(origin).normalize():new Vector3(1,0,0);if(direction.lengthSq()===0)direction.set(1,0,0);
      flash.userData.role='muzzle-flash';flash.quaternion.setFromUnitVectors(new Vector3(0,1,0),direction);flash.position.copy(origin).addScaledVector(direction,large?.23:.11);flash.scale.set(large?.18:.08,large?.48:.24,large?.18:.08);
      add(flash,(elapsed,quiet)=>{flash.visible=elapsed>=0&&elapsed<(quiet?.14:.09);opacity(flash,quiet?.4:1-elapsed/.09);});
      smoke(point,.03,large?6:3,large?.3:.13,'#a3a092',large?.9:.6);
    }
    function impact(point:EffectImpact,start:number,large=false){
      if(!point.outcome)return;const origin=at(point),colour=colourFor(point),life=large?.8:.6;
      if(point.outcome!=='hit'){const cloud=mesh('impact-dust','smoke',colour);cloud.userData.role='impact';add(cloud,(elapsed,quiet)=>{const age=elapsed-start,p=clamp(age/life);cloud.visible=age>=0&&age<life;cloud.position.copy(origin).add(new Vector3(0,p*.18,0));cloud.scale.setScalar((large?.18:.065)+p*(large?.45:.16));opacity(cloud,(quiet?.25:.42)*(1-p));});}
      for(let n=0;n<(point.outcome==='miss'?2:large?12:4);n++){const chip=mesh(`impact-chip:${n}`,point.material==='wood'?'box':'metal',colour),angle=rnd()*Math.PI*2,speed=(.12+rnd()*.4)*(large?2:1),up=.3+rnd()*.5,origin=at(point),size=point.outcome==='hit'?.024:.016+rnd()*.014;chip.userData.role='impact';chip.rotation.set(rnd()*3,rnd()*3,rnd()*3);chip.scale.set(size,size*(point.material==='wood'?3:1),size);add(chip,(elapsed,quiet)=>{const age=elapsed-start,p=clamp(age/life);chip.visible=age>=0&&age<life&&!quiet;chip.position.copy(origin).add(new Vector3(Math.cos(angle)*speed*p,up*p-.75*p*p,Math.sin(angle)*speed*p));opacity(chip,.8*(1-p));});}
    }
    function flight(points:readonly EffectPoint[],duration:number,kind:'grenade'|'knife'|'ball'|'bullet'){
      const sample=pathSampler(points,T),body=new Group();body.name='projectile';body.userData.role='projectile';group.add(body);
      if(kind==='knife'){
        const blade=mesh('knife-blade','cone','#c2c7c1'),handle=mesh('knife-handle','cylinder','#62492f');group.remove(blade,handle);body.add(blade,handle);blade.rotation.z=-Math.PI/2;blade.scale.set(.032,.24,.012);blade.position.x=.08;handle.rotation.z=Math.PI/2;handle.scale.set(.019,.105,.019);handle.position.x=-.085;
      }else{const ball=mesh(`${kind}-body`,'metal',kind==='grenade'?'#30362a':'#969789');group.remove(ball);body.add(ball);ball.scale.setScalar(kind==='grenade'?.073:kind==='ball'?.09:.028);if(kind==='grenade'){const fuse=mesh('grenade-fuse','cylinder','#b7a477');group.remove(fuse);body.add(fuse);fuse.position.y=.075;fuse.scale.set(.012,.05,.012);}}
      const current=new Vector3(),ahead=new Vector3();add(body,(elapsed,quiet)=>{const p=clamp(elapsed/duration);body.visible=elapsed>=0&&elapsed<duration&&!quiet;sample(p,current);body.position.copy(current);if(kind==='knife'){sample(Math.min(1,p+.001),ahead);const direction=ahead.sub(current);if(direction.lengthSq())body.quaternion.setFromUnitVectors(new Vector3(1,0,0),direction.normalize());}body.traverse(object=>{if(object instanceof Mesh)opacity(object,p>.9?(1-p)*10:1);});});
      return body;
    }
    function quietMarker(point:EffectPoint,start:number,end:number,colour:string){const marker=mesh('reduced-motion-marker','metal',colour,true);marker.userData.role='reduced-motion-marker';marker.position.copy(at(point));marker.scale.setScalar(.055);add(marker,(elapsed,quiet)=>{marker.visible=quiet&&elapsed>=start&&elapsed<end;opacity(marker,.65);});}
    if(event.kind==='grenade'){
      const v=event.visual,flightTime=Math.min(.45,entry.duration*.45);flight(v.points,flightTime,'grenade');quietMarker(v.impact,0,entry.duration,'#b7ad87');
      for(const point of v.contacts??[])impact({...point,outcome:'miss'},flightTime*clamp(point.fraction??1));
      if(v.detonated){const ground={x:v.landing.x,y:v.landing.y,height:v.landing.elevation},radius=v.radius*T,ring=mesh('grenade-blast-radius','ring','#d6b370',true),burst=mesh('grenade-blast','smoke','#edc37a',true);ring.userData.role='blast-radius';ring.userData.radiusMetres=radius;ring.rotation.x=-Math.PI/2;ring.position.copy(at(ground)).y+=.012;burst.position.copy(at(ground)).y+=.12;
        add(ring,(elapsed,quiet)=>{const age=elapsed-flightTime,p=clamp(age/.7);ring.visible=age>=0&&age<.7&&radius>0;ring.scale.setScalar(radius);opacity(ring,(quiet?.25:.45)*(1-p));});add(burst,elapsed=>{const age=elapsed-flightTime,p=clamp(age/.3);burst.visible=age>=0&&age<.3;burst.scale.setScalar(.14+Math.sin(Math.PI*p)*Math.min(.65,radius*.18));opacity(burst,1-p);});
        smoke(ground,flightTime+.05,10,Math.min(1.1,Math.max(.3,radius*.25)),'#535348',.7);impact({...ground,outcome:'cover'},flightTime,true);
      }
    }else if(event.kind==='knife'){
      flight([event.visual.source,event.visual.impact],Math.min(.35,entry.duration*.65),'knife');quietMarker(event.visual.impact,0,entry.duration,'#c2c7c1');
    }else if(event.kind==='firearm'){
      const v=event.visual;if(event.stage==='projectile'){if(v.discharge!==false)discharge(event.dischargeAnchor??v.source,v.impact);if(!v.spread)flight([v.source,v.impact],entry.duration,'bullet');quietMarker(v.impact,0,entry.duration,'#b8b6a6');}
      else if(v.outcome&&v.outcome!=='pellets'){impact({...v.impact,outcome:v.outcome,material:v.material},0);quietMarker(v.impact,0,entry.duration,colourFor({...v.impact,outcome:v.outcome,material:v.material}));}
    }else{
      const v=event.visual,stage=event.stage??'effect',travel=Math.min(.55,entry.duration*.55),end=v.impact??v.points?.at(-1),contacts=v.impacts??[];
      if(stage!=='impact'){if(v.discharge!==false)discharge(event.dischargeAnchor??v.source,end,true);if(!v.canister&&end)flight(v.points??[v.source,end],stage==='projectile'?entry.duration:travel,'ball');}
      if(stage!=='projectile')for(const point of contacts){impact(point,stage==='impact'?0:travel,true);quietMarker(point,stage==='impact'?0:travel,entry.duration,colourFor(point));}
    }
    return entry;
  }
  function draw(){for(const [id,entry]of entries){const elapsed=time-entry.event.startedAtSeconds;if(elapsed>=entry.duration){completed.set(id,entry.signature);remove(id);continue;}entry.group.visible=elapsed>=0;for(const part of entry.parts)part.draw(elapsed,reduced);}}
  return {
    update(input:CombatEffectsInput={}){
      if(disposed)throw Error('Combat effects are disposed.');
      if(['units','npcs','state','flight','trajectoryModel'].some(key=>key in input))throw Error('Combat effects accept admitted visual records, not state or private flight data.');
      if(Number.isFinite(input.timeSeconds))time=input.timeSeconds!;reduced=Boolean(input.reducedMotion);
      const wanted=new Set<string>();for(const event of input.events??[]){if(!validEvent(event)){rejected++;continue;}if(wanted.has(event.id)){rejected++;continue;}wanted.add(event.id);const signature=JSON.stringify(event),current=entries.get(event.id);if(current?.signature===signature||completed.get(event.id)===signature)continue;remove(event.id);completed.delete(event.id);if(time-event.startedAtSeconds>=eventDuration(event)){completed.set(event.id,signature);continue;}entries.set(event.id,create(event,signature));}
      for(const id of entries.keys())if(!wanted.has(id))remove(id);for(const id of completed.keys())if(!wanted.has(id))completed.delete(id);draw();
    },
    tick(_deltaSeconds:number,timeSeconds:number){if(disposed)return;if(Number.isFinite(timeSeconds))time=timeSeconds;draw();},
    inspect(){let meshes=0,triangles=0;root.traverse(object=>{if(object instanceof Mesh){meshes++;triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3;}});return {disposed,rejected,events:[...entries.values()].map(entry=>({id:entry.event.id,kind:entry.event.kind,stage:entry.event.stage,elapsed:time-entry.event.startedAtSeconds,duration:entry.duration})),meshes,triangles,geometries:geometries.size};},
    dispose(){if(disposed)return;for(const id of entries.keys())remove(id);completed.clear();for(const g of geometries.values())g.dispose();geometries.clear();scene.remove(root);disposed=true;}
  };
}
