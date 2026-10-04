import {Group,PointLight,Quaternion,Vector3} from 'three';
import {WorldBatch,seeded} from './world-geometry';
import {illuminationAt} from './world-materials';
import type {WorldGeometry} from './world-geometry';
import type {WorldMaterials} from './world-materials';
import type {WorldInput,WorldLight,WorldSmoke} from './world-types';

export function lightActive(light:WorldLight){return !light.extinguished&&light.turns!==0&&light.remainingSeconds!==0;}
export function buildLight(id:string,source:WorldLight,input:WorldInput,T:number,geometry:WorldGeometry,materials:WorldMaterials,pointLight=true){
  const batch=new WorldBatch(geometry),light=illuminationAt(input,source),wood=materials.get('darkwood'),iron=materials.get('iron'),active=lightActive(source),flame=materials.get('flame',{emissive:active}),kind=source.type??'campfire';
  let height=.30;
  if(kind==='campfire'){
    for(let n=0;n<5;n++){
      const a=n*Math.PI*.4;batch.cylinder(wood,new Vector3(Math.cos(a)*-.26,.06,Math.sin(a)*-.26),new Vector3(Math.cos(a)*.26,.09,Math.sin(a)*.26),.044,light);
    }
    for(let n=0;n<9;n++){const a=n*Math.PI*2/9;batch.primitive('rock',materials.get('stone'),[Math.cos(a)*.37,.04,Math.sin(a)*.37],[.10,.075,.10],undefined,light);}
    batch.primitive('sphere',materials.get('ember',{emissive:active}),[0,.08,0],[.19,.045,.16],undefined,light);height=.30;
  }else if(kind==='lantern'){
    height=1.23;batch.box(wood,0,.49,0,.07,.98,.07,light);batch.box(iron,.105,1.04,0,.27,.04,.035,light);batch.box(iron,.19,1.44,0,.21,.045,.18,light);batch.box(iron,.19,1.16,0,.21,.055,.18,light);
    for(const x of [.10,.28])for(const z of [-.073,.073])batch.box(iron,x,1.30,z,.014,.28,.014,light);
    batch.box(materials.get('glass',{opacity:.30}),.19,1.30,0,.17,.23,.14,light);batch.primitive('cone',iron,[.19,1.48,0],[.145,.11,.13],undefined,light);
  }else{
    height=.62;batch.cylinder(wood,new Vector3(0,.04,0),new Vector3(.08,.57,0),.028,light);batch.cylinder(materials.get('linen'),new Vector3(.065,.49,0),new Vector3(.087,.62,0),.055,light);
  }
  const group=batch.finish(`light:${id}`);group.position.set(source.x*T,source.elevation??0,source.y*T);group.userData.kind='light';group.userData.semanticId=`light:${id}`;
  if(active){
    const fire=new WorldBatch(geometry),x=kind==='lantern'?.19:0;
    fire.primitive('cone',flame,[x,height,0],[kind==='campfire'?.14:.033,kind==='campfire'?.35:.105,kind==='campfire'?.12:.030],undefined,1);
    if(kind==='campfire')for(let n=0;n<3;n++)fire.primitive('cone',materials.get('ember',{emissive:true}),[(n-1)*.09,height*.8,.04],[.07,.24,.06],new Quaternion().setFromAxisAngle(new Vector3(0,0,1),(n-1)*.16),1);
    const flames=fire.finish(`flame:${id}`);group.add(flames);group.userData.flame=flames;group.userData.seed=seeded(Math.floor(source.x),Math.floor(source.y),9);
    if(pointLight){const lamp=new PointLight('#ffd0a1',(input.terrain.night?3.8:1.2)*(source.intensity??1),(source.radius??4)*T,2);lamp.position.set(x,height+.1,0);group.add(lamp);group.userData.lamp=lamp;}
  }
  return group;
}

export function buildSmoke(id:string,source:WorldSmoke,input:WorldInput,T:number,geometry:WorldGeometry,materials:WorldMaterials){
  const batch=new WorldBatch(geometry),radius=(source.radius??1)*T,seed=seeded(Math.floor(source.x),Math.floor(source.y),43);
  for(let n=0;n<7;n++){
    const angle=n*2.4+seed*3,r=radius*(n===0?.66:.45),distance=n===0?0:radius*.55;
    batch.primitive('sphere',materials.get('smoke',{opacity:n===0?.20:.12}),[Math.cos(angle)*distance,.50+n*.14,Math.sin(angle)*distance],[r,r*.75,r],undefined,illuminationAt(input,source));
  }
  const group=batch.finish(`smoke:${id}`);group.position.set(source.x*T,source.elevation??0,source.y*T);group.userData.kind='smoke';group.userData.semanticId=`smoke:${id}`;group.userData.seed=seed;group.userData.baseY=group.position.y;return group;
}

export function animateWorldNode(group:Group,time:number,reducedMotion:boolean){
  if(reducedMotion)return;
  const seed=Number(group.userData.seed??0),phase=time*2.6+seed*7;
  const flame=group.userData.flame as Group|undefined,lamp=group.userData.lamp as PointLight|undefined;
  if(flame)flame.scale.set(1+.08*Math.sin(phase),1+.11*Math.sin(phase*1.7),1+.05*Math.cos(phase));
  if(lamp){if(group.userData.lampIntensity===undefined)group.userData.lampIntensity=lamp.intensity;lamp.intensity=group.userData.lampIntensity*(1+.04*Math.sin(phase*1.7));}
  if(group.userData.kind==='smoke'){group.rotation.y=Math.sin(time*.11+seed)*.035;group.position.y=Number(group.userData.baseY)+.035*Math.sin(time*.67+seed);}
}

export function buildClimbLinks(input:WorldInput,T:number,geometry:WorldGeometry,materials:WorldMaterials){
  const batch=new WorldBatch(geometry),wood=materials.get('wood'),iron=materials.get('iron');
  for(const link of input.terrain.climbLinks??[]){
    const a=new Vector3(link.from.x*T,link.from.elevation??0,link.from.y*T),b=new Vector3(link.to.x*T,link.to.elevation??3,link.to.y*T),delta=b.clone().sub(a),light=illuminationAt(input,link.from);
    const across=new Vector3(-delta.z,0,delta.x);if(across.lengthSq()<.001)across.set(1,0,0);across.normalize().multiplyScalar(.23);
    if(/stair/.test(link.kind)){
      const steps=Math.max(3,Math.ceil(Math.abs(delta.y)/.23));for(let n=0;n<steps;n++){const p=a.clone().addScaledVector(delta,(n+.5)/steps),y=a.y+delta.y*(n+1)/steps;batch.box(wood,p.x,(a.y+y)*.5,p.z,Math.max(.5,Math.abs(delta.x)/steps+.02),Math.max(.08,y-a.y),Math.max(.5,Math.abs(delta.z)/steps+.02),light);}
    }else{
      for(const side of [-1,1])batch.cylinder(wood,a.clone().addScaledVector(across,side),b.clone().addScaledVector(across,side),.035,light);
      const steps=Math.max(2,Math.ceil(delta.length()/.29));for(let n=1;n<steps;n++){const p=a.clone().addScaledVector(delta,n/steps);batch.cylinder(wood,p.clone().sub(across),p.clone().add(across),.026,light);}batch.cylinder(iron,b.clone().sub(across),b.clone().add(across),.022,light);
    }
  }
  const group=batch.finish('climb-links');group.userData.kind='climb-links';group.userData.semanticIds=(input.terrain.climbLinks??[]).map(link=>`climb:${link.id}`);return group;
}
