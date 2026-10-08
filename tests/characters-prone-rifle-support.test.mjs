import{register}from'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import assert from'node:assert/strict';import test from'node:test';import{Vector3}from'../web/node_modules/three/build/three.module.js';import{publishedActor}from'./published-actor-fixture.mjs';
const{ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');const{presentActors}=await import('../web/lib/three/presentation.ts');const{createBattle,presentedActBattle,actBattle}=await import('../game/tactical.js');const{presentedFrameDuration}=await import('../web/lib/useEnemyPlayback.ts');
test('all 48 ordinary prone rifle routes keep complete weighted boot support and native dimensions across every LOD',async t=>{
const results=[];
for(const appearance of['granadero','woman-scout'])for(const lod of[0,1,2])for(const task of['aim','fire',1800,1801,1802,1803,1804,1807]){
 const loading=typeof task==='number',weapon=loading?task:1800;
 const state=createBattle([{id:'rifle',name:'Prone rifle',x:2,y:2,facing:2,weapon,activeSlot:'primary',weaponInstanceId:'prone-owned',loaded:loading?0:1,ammo:8,condition:91,energy:100,stance:'prone',movementMode:'prone',spriteAppearance:appearance,agility:90,dexterity:90,wisdom:90,strength:90,experienceLevel:7}],{width:20,height:8,seed:45,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),enemies:[],exploration:true});state.deploymentComplete=true;state.units[0].ap=100;const before=JSON.stringify(state),unit=s=>s.units.find(u=>u.id==='rifle'),show=(s,mode,frame,now)=>presentActors(s,[{key:'unit:rifle',kind:'unit',actor:unit(s)}],{},new Set(),{selected:'rifle',mode,frame,now})[0],asset=await publishedActor(appearance,lod),initial=show(state,'move',undefined,0),actor=new ActorRuntime(asset,initial),mesh=actor.model.getObjectByName(asset.appearance.parts.footwear.replace('{lod}',String(lod))),indices=Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>i),native=new Map();actor.model.traverse(n=>{if(n.isBone)native.set(n.name,{position:n.position.clone(),scale:n.scale.clone()});});
 let minimum=Infinity,maximumContact=0,maximumSpeed=0,prior,priorNow,baselineMinimum,now=0;
 const sample=(shown,time)=>{const dt=priorNow===undefined?0:(time-priorNow)/1000;actor.update(shown,time);actor.tick(Math.min(.1,Math.max(0,dt)),time);actor.root.updateMatrixWorld(true);mesh.skeleton.update();const points=[],feet={l:Infinity,r:Infinity};for(const i of indices){const p=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld);p.y-=shown.position[1];points.push(p);const side=mesh.geometry.attributes.position.getX(i)>0?'l':'r';feet[side]=Math.min(feet[side],p.y);if(prior&&dt>0)maximumSpeed=Math.max(maximumSpeed,p.distanceTo(prior[i])/dt);}minimum=Math.min(minimum,feet.l,feet.r);maximumContact=Math.max(maximumContact,feet.l,feet.r);prior=points;priorNow=time;assert.deepEqual(actor.root.position.toArray(),shown.position);assert.equal(actor.root.rotation.y,shown.yaw);for(const[n,shape]of native){const bone=actor.model.getObjectByName(n);if(n!=='Root')assert.ok(bone.position.distanceTo(shape.position)<1e-6,n+' native offset');assert.ok(bone.scale.distanceTo(shape.scale)<1e-6,n+' native scale');}return Math.min(feet.l,feet.r);};
 try{
  for(let i=0;i<=30;i++)sample(show(state,'move',undefined,i*1000/60),i*1000/60);baselineMinimum=minimum;now=500;
  if(task==='aim'){
   for(let i=1;i<=30;i++){now=500+i*1000/60;sample(show(state,'fire',undefined,now),now);assert.equal(actor.action.getClip().name,'prone.aim.long-gun');}
   for(let i=1;i<=30;i++){now=1000+i*1000/60;sample(show(state,'move',undefined,now),now);}
  }else{
   const order=loading?{type:'reload',unitId:'rifle'}:{type:'firePoint',unitId:'rifle',x:9,y:2,part:'torso',aim:0};const outcome=presentedActBattle(state,order);assert.equal(outcome.state.lastError,null,outcome.state.lastError);assert.deepEqual(outcome.state,actBattle(state,order));assert.equal(JSON.stringify(state),before);let start=500;const durations=outcome.frames.map(f=>presentedFrameDuration(f,state)),total=durations.reduce((a,b)=>a+b,0),seen=new Set();
   for(const[index,f]of outcome.frames.entries()){
    const duration=durations[index],frame={...f,index,sequenceId:'prone-native-review',actionId:1,startedAt:start,durationMs:duration,actionStartedAt:500,actionDurationMs:total},stop=start+duration;
    for(let t=start;t<stop-1e-5;t+=1000/60){sample(show(f.state,'fire',frame,t),t);seen.add(actor.action.getClip().name);}
    if(!duration)sample(show(f.state,'fire',frame,start),start);start=stop;
   }
   for(let i=1;i<=40;i++){now=start+i*1000/60;sample(show(outcome.state,'move',undefined,now),now);}
   assert.ok(seen.has(loading?'prone.reload.long-gun.'+weapon:'prone.fire.long-gun'),'Actual admitted work selected the owned item clip');assert.equal(unit(outcome.state).weaponInstanceId,'prone-owned');
  }
  assert.ok(minimum>=baselineMinimum-1e-7,'No extra complete-boot penetration versus this LOD native idle: '+minimum+' vs '+baselineMinimum);assert.ok(minimum>0,'No complete boot crosses the floor');assert.ok(maximumContact<.003,'Both boot contacts remain within existing 3 mm prone support');assert.ok(maximumSpeed<.0001,'The fixed prone boot support does not slide or jump: '+maximumSpeed);assert.equal(JSON.stringify(state),before);results.push({appearance,lod,task,baselineMinimum,minimum,maximumContact,maximumSpeed,endingClip:actor.action.getClip().name});
 }finally{actor.dispose();}
}
t.diagnostic(JSON.stringify({checks:results.length,minimum:Math.min(...results.map(r=>r.minimum)),maximumContact:Math.max(...results.map(r=>r.maximumContact)),maximumSpeed:Math.max(...results.map(r=>r.maximumSpeed))},null,2));

});
