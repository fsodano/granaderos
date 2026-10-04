import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
const {Scene,Mesh,Vector3}=await import('../web/node_modules/three/build/three.module.js');
const {createCombatEffects}=await import('../web/lib/three/combat-effects.ts');
const T=1.2360585147470482;
const point=(x,y,height,fraction)=>({x,y,height,...(fraction===undefined?{}:{fraction})});
const grenade=(overrides={})=>({id:'grenade',kind:'grenade',startedAtSeconds:10,visual:{visible:true,source:point(2,3,.9),impact:point(6,3,3.2),landing:{x:6,y:3,elevation:3.2},points:[point(2,3,1.4,0),point(4,3,5,.5),point(6,3,3.2,1)],radius:2,detonated:true,...overrides}});
const shot=(overrides={},stage='projectile')=>({id:'shot',kind:'firearm',stage,startedAtSeconds:10,visual:{visible:true,source:point(2,3,4.1),impact:point(7,3,4.6),outcome:'cover',material:'wood',...overrides}});
function setup(events=[],timeSeconds=10){const scene=new Scene(),effects=createCombatEffects(scene,{tileMetres:T});effects.update({events,timeSeconds});return {scene,effects,root:scene.getObjectByName('combat-effects')};}
function frozen(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))frozen(child);}return value;}
function near(actual,expected){assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);}
function roles(root,role){const objects=[];root.traverse(object=>{if(object.userData.role===role)objects.push(object);});return objects;}

test('grenade uses supplied flight samples, heights and metric blast radius without mutation',()=>{
 const event=frozen(grenade()),before=JSON.stringify(event),{effects,root}=setup([event]);
 const body=root.getObjectByName('projectile');near(body.position.y,1.4);near(body.position.x,2*T);
 effects.tick(.225,10.225);near(body.position.x,4*T);near(body.position.y,5);
 effects.tick(.226,10.451);near(body.position.x,6*T);near(body.position.y,3.2);assert.equal(body.visible,false);
 const ring=root.getObjectByName('grenade-blast-radius');near(ring.userData.radiusMetres,2*T);near(ring.position.y,3.212);near(ring.scale.x,2*T);assert.equal(ring.visible,true);assert.equal(JSON.stringify(event),before);effects.dispose();
});

test('undetonated grenades show the admitted throw without creating a blast',()=>{
 const {effects,root}=setup([grenade({detonated:false})]);assert.ok(root.getObjectByName('grenade-body'));assert.equal(root.getObjectByName('grenade-blast'),undefined);assert.equal(root.getObjectByName('grenade-blast-radius'),undefined);effects.dispose();
});

test('knife and cannonball preserve elevated source/end points',()=>{
 const knife={id:'knife',kind:'knife',startedAtSeconds:10,visual:{visible:true,source:point(1,2,4.4),impact:point(3,4,3.1),weapon:1813}},artillery={id:'artillery',kind:'artillery',stage:'projectile',startedAtSeconds:10,durationSeconds:.5,visual:{visible:true,source:point(5,6,3.7),impact:point(9,6,4.5),points:[point(5,6,3.7,0),point(7,6,5.4,.5),point(9,6,4.5,1)]}};
 const {effects,root}=setup([knife,artillery]),blade=root.getObjectByName('effect:knife').getObjectByName('projectile'),ball=root.getObjectByName('effect:artillery').getObjectByName('projectile');near(blade.position.y,4.4);near(ball.position.y,3.7);
 effects.tick(.25,10.25);near(ball.position.y,5.4);near(ball.position.x,7*T);effects.tick(.1,10.35);near(blade.position.y,3.1);near(blade.position.x,3*T);near(blade.position.z,4*T);effects.dispose();
});

test('hidden/invalid records allocate nothing and remove previously admitted effects',()=>{
 const {effects,root}=setup([shot()]);assert.ok(effects.inspect().meshes>0);
 const invalid=[shot({visible:false}),{...shot(),id:'bad-height',visual:{...shot().visual,impact:point(3,4,NaN)}},{...grenade(),id:'bad-path',visual:{...grenade().visual,points:[point(1,2,3)]}},{...grenade(),id:'missing-ground',visual:{...grenade().visual,landing:{x:6,y:3}}},{...shot(),id:'bad-time',startedAtSeconds:Infinity},{...shot(),id:'bad-kind',kind:'private-flight'}];
 effects.update({events:invalid,timeSeconds:10});assert.equal(root.children.length,0);assert.equal(effects.inspect().meshes,0);assert.equal(effects.inspect().rejected,6);assert.throws(()=>effects.update({state:{units:[]}}),/admitted visual/);effects.dispose();
});

test('firearm continuation has no discharge and impact stage uses only its admitted outcome',()=>{
 const first=shot(),continuation={...shot({discharge:false}),id:'ricochet',startedAtSeconds:10.1}, {effects,root}=setup([first,continuation],10.1);
 assert.equal(roles(root.getObjectByName('effect:shot'),'muzzle-flash').length,1);assert.equal(roles(root.getObjectByName('effect:ricochet'),'muzzle-flash').length,0);assert.equal(roles(root.getObjectByName('effect:ricochet'),'smoke').length,0);assert.equal(roles(root.getObjectByName('effect:ricochet'),'projectile').length,1);
 effects.update({events:[shot({},'impact')],timeSeconds:10});assert.equal(roles(root,'muzzle-flash').length,0);assert.ok(roles(root,'impact').length>0);
 effects.update({events:[shot({outcome:null},'impact')],timeSeconds:10});assert.equal(effects.inspect().meshes,0);effects.dispose();
});

test('canister/pellets never manufacture visible pellet rays or hidden impacts',()=>{
 const canister={id:'canister',kind:'artillery',startedAtSeconds:10,visual:{visible:true,source:point(2,3,1),canister:true,impacts:[{...point(5,4,1.2),outcome:'cover',material:'stone'}]}}, {effects,root}=setup([canister,shot({spread:true,outcome:'pellets'})]);
 assert.equal(roles(root,'projectile').length,0);assert.equal(roles(root,'muzzle-flash').length,2);assert.ok(roles(root.getObjectByName('effect:canister'),'impact').length>0);effects.dispose();
});

test('admitted muzzle anchor changes only discharge geometry, preserving the supplied flight',()=>{
 const event={...shot(),actorKey:'unit:gunner',dischargeAnchor:point(2.3,3.2,5.1)},plain=setup([shot()]),anchored=setup([event]);
 const first=plain.root.getObjectByName('muzzle-flash'),second=anchored.root.getObjectByName('muzzle-flash');assert.notDeepEqual(first.position.toArray(),second.position.toArray());near(roles(anchored.root,'smoke')[0].position.y,5.1);
 const body=anchored.root.getObjectByName('projectile');near(body.position.x,2*T);near(body.position.y,4.1);anchored.effects.tick(.16,10.16);plain.effects.tick(.16,10.16);assert.deepEqual(body.position.toArray(),plain.root.getObjectByName('projectile').position.toArray());
 anchored.effects.dispose();plain.effects.dispose();
 const invalid=setup([{...event,dischargeAnchor:point(1,2,Infinity)}]);assert.equal(invalid.effects.inspect().events.length,0);invalid.effects.dispose();
 const sourceOnly=setup([{id:'source-only',kind:'artillery',cannonId:'gun',startedAtSeconds:10,visual:{visible:true,source:point(2,3,.65),discharge:true,impacts:[]}}]);assert.equal(roles(sourceOnly.root,'muzzle-flash').length,1);assert.equal(roles(sourceOnly.root,'projectile').length,0);sourceOnly.effects.dispose();
 const endOnly=setup([{id:'end-only',kind:'artillery',startedAtSeconds:10,visual:{visible:true,source:point(2,3,.65),impact:point(5,3,.65)}}]);assert.equal(roles(endOnly.root,'impact').length,0);endOnly.effects.dispose();
});

test('unchanged events reuse geometry and do not restart after their end',()=>{
 const event=shot(),{effects,root}=setup([event]),uuid=root.getObjectByName('effect:shot').uuid;
 effects.update({events:[structuredClone(event)],timeSeconds:10.05});assert.equal(root.getObjectByName('effect:shot').uuid,uuid);
 effects.tick(.1,10.15);assert.equal(root.getObjectByName('muzzle-flash').visible,false);
 effects.tick(1,11);assert.equal(root.children.length,0);effects.update({events:[event],timeSeconds:11});assert.equal(root.children.length,0);
 effects.update();assert.equal(effects.inspect().events.length,0);effects.update({events:[{...event,startedAtSeconds:12}],timeSeconds:12});assert.equal(root.children.length,1);effects.dispose();
});

test('clock controls pause/reduced motion and future effects remain hidden',()=>{
 const {effects,root}=setup([grenade()],9);assert.equal(root.getObjectByName('effect:grenade').visible,false);
 effects.tick(.1,10.2);const body=root.getObjectByName('projectile'),position=body.position.clone();effects.tick(4,10.2);assert.ok(position.equals(body.position),'delta alone must not advance the supplied clock');
 effects.update({events:[grenade()],timeSeconds:10.2,reducedMotion:true});assert.equal(body.visible,false);assert.equal(root.getObjectByName('reduced-motion-marker').visible,true);
 effects.tick(.3,10.5);assert.equal(root.getObjectByName('grenade-blast-radius').visible,true);effects.dispose();
});

test('cosmetic particle motion is deterministic and independent of UUID randomness',()=>{
 // Three generates UUIDs through Math.random; cosmetic trajectories use their
 // own seeded stream and remain identical when the UUID stream changes.
 const original=Math.random;
 try{Math.random=()=>.1;const a=setup([grenade()],10.8);Math.random=()=>.9;const b=setup([grenade()],10.8),positions=root=>roles(root,'smoke').map(mesh=>[...mesh.position.toArray(),...mesh.scale.toArray(),mesh.material.opacity]);assert.deepEqual(positions(a.root),positions(b.root));a.effects.dispose();b.effects.dispose();}finally{Math.random=original;}
});

test('effects dispose all owned materials and shared geometries exactly once',()=>{
 const {effects,scene,root}=setup([grenade(),shot()]),geometries=new Set(),materials=new Set();let geometryDisposals=0,materialDisposals=0;
 root.traverse(object=>{if(object instanceof Mesh){geometries.add(object.geometry);materials.add(object.material);}});for(const geometry of geometries)geometry.addEventListener('dispose',()=>geometryDisposals++);for(const material of materials)material.addEventListener('dispose',()=>materialDisposals++);
 effects.dispose();effects.dispose();assert.equal(geometryDisposals,geometries.size);assert.equal(materialDisposals,materials.size);assert.equal(scene.getObjectByName('combat-effects'),undefined);assert.equal(effects.inspect().disposed,true);assert.throws(()=>effects.update(),/disposed/);
});
