import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,knifeThrowPreview,getKnifeThrowVisual,canSee,actionCosts} from '../game/tactical.js';
import {heldThrowingKnife,knifeThrowChance,knifeThrowRange} from '../game/thrown-knife.js';
import {handRecord,itemQuantity,inventoryUsage} from '../game/tactical-inventory.js';
import {heldItemIds,fittingItemIds} from '../game/weapon-fittings.js';
import {handLayout} from '../game/hand-layout.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {noiseRadius} from '../game/tactical-awareness.js';
import {spacePoint,tacticalLevel} from '../game/tactical-space.js';

const empty={ammo:0,priming:0,flints:0,medkits:0,rations:0,boleadoras:0,torches:0};
const floor=()=>Array.from({length:240},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0}));
const roof=(x,y=3)=>({id:`roof:${x}:${y}`,x,y,tacticalLevel:1,type:'floor',kind:'roof',elevation:3,blocked:false,cover:0});
const enemy=(extra={})=>({...empty,id:'e',x:5,y:3,weapon:0,loaded:0,activeSlot:'unarmed',patrol:false,overwatch:false,agility:0,experienceLevel:1,...extra});
function field(player={},enemies=[enemy()],sector={}){
 return createBattle([{...empty,id:'p',x:2,y:3,weapon:1813,weaponInstanceId:'knife-owned',condition:73,loaded:0,ammo:7,priming:13,flints:3,agility:100,dexterity:100,strength:100,marksmanship:100,wisdom:100,experienceLevel:10,...player}],{width:24,height:10,tiles:floor(),seed:45,enemies,...sector});
}
const unit=(s,id='p')=>s.units.find(u=>u.id===String(id));
const order=(s,a)=>{const n=actBattle(s,{unitId:'p',...a});assert.equal(n.lastError,null,JSON.stringify(a)+': '+n.lastError);assert.doesNotThrow(()=>validateBattleSnapshot(n));return n;};
function records(s){return [...s.units.flatMap(u=>['primary','blade','offhand'].filter(slot=>itemQuantity(u,slot)).map(slot=>({owner:u.id,slot,...handRecord(u,slot)}))),...s.units.flatMap(u=>Object.values(u.inventory??{}).filter(r=>r?.count>0).map(r=>({owner:u.id,...r}))),...s.groundItems.filter(g=>g.count>0),...s.droppedWeapons.filter(g=>!g.taken)];}
function exactKnife(s,before,id='knife-owned'){
 const current=records(s).filter(r=>r.instanceId===id);assert.equal(current.length,1,'one physical knife custodian');
 for(const key of ['weapon','condition','loaded','jammed','instanceId','weight','fittingPattern'])assert.deepEqual(current[0][key],before[key],key);
 return current[0];
}
function reject(s,a){
 const before=structuredClone(s),n=actBattle(s,{unitId:'p',...a});assert.ok(n.lastError,JSON.stringify(a));
 const {lastError:actualError,log:actualLog,...actual}=n,{lastError:expectedError,log:expectedLog,...expected}=s;assert.deepEqual(actual,expected);
 assert.deepEqual(s,before);assert.equal(getKnifeThrowVisual(s,n),null);return n;
}

test('a paid aimed throw removes exactly the held blade and preserves every firearm supply',()=>{
 const s=field(),p=unit(s),record=handRecord(p,'primary'),before=structuredClone(s),preview=knifeThrowPreview(s,p,unit(s,'e'),{aim:3});
 assert.equal(preview.valid,true);assert.equal(preview.costs.aim,9);assert.equal(preview.pa,preview.costs.attack+9);assert.deepEqual(s,before);
 const n=order(s,{type:'throwKnife',targetId:'e',aim:3});assert.ok(unit(n,'e').hp<unit(s,'e').hp);assert.equal(unit(n).ap,p.ap-preview.pa);assert.equal(unit(n).energy,p.energy-6);
 assert.equal(unit(n).weaponDropped,true);assert.equal(unit(n).weaponInstanceId,undefined);assert.equal(unit(n).activeSlot,'unarmed');assert.equal(exactKnife(n,record).owner,'e');
 for(const key of ['ammo','priming','flints','loaded','jammed','condition'])assert.equal(unit(n)[key],p[key],key);
 assert.deepEqual(n.smoke,s.smoke);assert.deepEqual(n.droppedWeapons,s.droppedWeapons);assert.equal(n.elapsedSeconds,6);assert.deepEqual(s,before);
 const visual=getKnifeThrowVisual(s,n);assert.ok(visual);assert.equal(visual.weapon,1813);assert.equal(visual.source.height,1.4);assert.equal(visual.impact.kind,'body');assert.equal(getKnifeThrowVisual(n,n),null);
 visual.weapon=0;assert.equal(getKnifeThrowVisual(s,n).weapon,1813);assert.equal(JSON.stringify(n).includes('knifeThrowVisual'),false);
 reject(n,{type:'throwKnife',targetId:'e'});exactKnife(n,record);
});

test('throwing the active secondary preserves a loaded pistol and promotes that remaining hand',()=>{
 const s=field({weapon:1805,weaponInstanceId:'pistol-owned',condition:41,loaded:1,jammed:true,blade:1813,bladeInstanceId:'knife-owned',bladeCondition:67,activeSlot:'blade',inventory:{spare:{weapon:1813,count:1,weight:.6,condition:29,loaded:0,instanceId:'spare-owned'}}}),p=unit(s),knife=handRecord(p,'blade'),gun=handRecord(p,'primary');
 assert.equal(handLayout(p).left,'primary');const n=order(s,{type:'throwKnife',targetId:'e'});
 assert.equal(unit(n).blade,undefined);assert.equal(unit(n).bladeInstanceId,undefined);assert.equal(unit(n).bladeCondition,undefined);assert.equal(unit(n).activeSlot,'primary');
 assert.deepEqual(handRecord(unit(n),'primary'),gun);assert.deepEqual(unit(n).inventory,p.inventory);assert.equal(unit(n).weaponReady,undefined);exactKnife(n,knife);
 assert.equal(records(n).filter(r=>r.instanceId==='spare-owned').length,1);reject(n,{type:'throwKnife',targetId:'e'});
});

test('an offhand knife must be readied through a real swap, preserving the pistol in both transactions',()=>{
 let s=field({weapon:1805,weaponInstanceId:'pistol-owned',loaded:1,condition:47,jammed:true,offHand:{weapon:1813,count:1,weight:.6,loaded:0,condition:69,instanceId:'knife-owned'}});
 const gun=handRecord(unit(s),'primary'),knife=handRecord(unit(s),'offhand');assert.equal(handLayout(unit(s)).left,'offhand');assert.equal(heldThrowingKnife(unit(s)),null);reject(s,{type:'throwKnife',targetId:'e'});
 s=order(s,{type:'swapHands'});assert.equal(unit(s).weapon,1813);assert.equal(unit(s).weaponInstanceId,'knife-owned');assert.deepEqual(handRecord(unit(s),'offhand'),gun);
 s=order(s,{type:'throwKnife',targetId:'e'});assert.deepEqual(handRecord(unit(s),'primary'),gun);assert.equal(unit(s).offHand,undefined);exactKnife(s,knife);
});

test('a full pack does not discard the other held weapon when the main knife leaves',()=>{
 const s=field({...empty,offHand:{weapon:1805,count:1,weight:1.3,condition:46,loaded:1,jammed:true,instanceId:'other-hand'},inventory:{bulk:{count:48,weight:1}}}),p=unit(s),knife=handRecord(p,'primary');
 assert.equal(inventoryUsage(p).used,12);assert.equal(handLayout(p).left,'offhand');
 const n=order(s,{type:'throwKnife',targetId:'e'});assert.equal(unit(n).weapon,1805);assert.equal(unit(n).weaponInstanceId,'other-hand');assert.equal(unit(n).condition,46);assert.equal(unit(n).loaded,1);assert.equal(unit(n).jammed,true);assert.equal(unit(n).offHand,undefined);assert.deepEqual(unit(n).inventory,p.inventory);assert.equal(inventoryUsage(unit(n)).used,12);exactKnife(n,knife);
});

test('a failed accuracy roll drops the real knife and never synthesizes another from a spare',()=>{
 const s=field({dexterity:0,marksmanship:0,inventory:{spare:{weapon:1813,count:1,weight:.6,condition:22,loaded:0,instanceId:'spare-owned'}}}),p=unit(s),knife=handRecord(p,'primary');
 assert.equal(knifeThrowPreview(s,p,unit(s,'e')).chance,1);
 const n=order(s,{type:'throwKnife',targetId:'e'});assert.equal(unit(n,'e').hp,unit(s,'e').hp);assert.equal(n.groundItems.filter(g=>g.count>0).length,1);assert.equal(exactKnife(n,knife).owner,undefined);assert.deepEqual(unit(n).inventory,p.inventory);
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(n)));assert.deepEqual(restored,n);assert.equal(getKnifeThrowVisual(n,restored),null);
 const action={type:'loot',groundId:n.groundItems[0].id},recovered=order(n,action);assert.deepEqual(order(restored,action),recovered);assert.equal(n.groundItems[0].count,1);assert.equal(recovered.groundItems[0].count,0);assert.equal(exactKnife(recovered,knife).owner,'p');reject(recovered,action);
});

test('cover impact is a paid throw with one recoverable knife on the near side',()=>{
 const wallEdges=[{id:'knife-screen',x:4,y:3,axis:'y',type:'wall',material:'adobe',blocked:true,blocksSight:true,cover:40,obstacleHeight:2.5}];
 const s=field({},[enemy()],{wallEdges}),p=unit(s),knife=handRecord(p,'primary'),point={x:7,y:3,tacticalLevel:0};
 const preview=knifeThrowPreview(s,p,point);assert.equal(preview.valid,true);assert.equal(preview.chance,0);assert.equal(preview.flight.blocked,true);
 const n=order(s,{type:'throwKnife',...point});assert.equal(unit(n).ap,p.ap-preview.pa);assert.equal(unit(n).energy,p.energy-6);assert.equal(unit(n,'e').hp,unit(s,'e').hp);assert.deepEqual(spacePoint(n.groundItems[0]),{x:3,y:3,tacticalLevel:0});exactKnife(n,knife);
});

test('a full victim pack falls back to the exact roof impact surface and permits paid cross-floor recovery',()=>{
 const upperSurfaces=[roof(5),roof(5,4)],climbLinks=[{id:'roof-access',kind:'climb',from:{x:4,y:4,tacticalLevel:0},to:{x:5,y:4,tacticalLevel:1}}];
 const s=field({},[enemy({tacticalLevel:1,inventory:{bulk:{count:48,weight:1}}})],{upperSurfaces,climbLinks}),p=unit(s),knife=handRecord(p,'primary');
 assert.equal(inventoryUsage(unit(s,'e')).used,12);let n=order(s,{type:'throwKnife',targetId:'e'});assert.ok(unit(n,'e').hp<100);assert.deepEqual(unit(n,'e').inventory,unit(s,'e').inventory);assert.deepEqual(spacePoint(n.groundItems[0]),{x:5,y:3,tacticalLevel:1});exactKnife(n,knife);
 const groundId=n.groundItems[0].id;n=order(n,{type:'move',x:4,y:4,tacticalLevel:0});assert.equal(unit(n).blade,undefined);n=order(n,{type:'climb',linkId:'roof-access'});assert.equal(tacticalLevel(unit(n)),1);
 n=order(n,{type:'loot',groundId});assert.equal(n.groundItems.find(g=>g.id===groundId).count,0);assert.equal(exactKnife(n,knife).owner,'p');assert.ok(unit(n).ap<p.ap);assert.ok(unit(n).energy<p.energy-6);
});

test('Cabral receives the knife that struck his protected commander, together with the actual damage',()=>{
 const s=field({},[enemy({id:57,leadership:99}),enemy({id:3,x:5,y:4,hp:96,maxHp:96})]),knife=handRecord(unit(s),'primary'),ap=unit(s,3).ap;
 const n=order(s,{type:'throwKnife',targetId:57});assert.equal(unit(n,57).hp,100);assert.ok(unit(n,3).hp<96);assert.equal(unit(n,3).ap,ap-8);assert.equal(exactKnife(n,knife).owner,'3');assert.equal(Object.values(unit(n,57).inventory).some(r=>r.instanceId==='knife-owned'),false);assert.ok(n.log.some(line=>line.includes('se interpone')));
});

test('head, torso and legs apply their own damage effects while prone targets allow torso only',()=>{
 const losses=[];
 for(const hitLocation of ['head','torso','legs']){
  const s=field(),n=order(s,{type:'throwKnife',targetId:'e',hitLocation});assert.equal(unit(n,'e').lastHitLocation,hitLocation);losses.push(100-unit(n,'e').hp);exactKnife(n,handRecord(unit(s),'primary'));
 }
 assert.ok(losses[0]>losses[1]&&losses[1]>losses[2]);
 const prone=field({},[enemy({stance:'prone',movementMode:'prone'})]);for(const hitLocation of ['head','legs'])reject(prone,{type:'throwKnife',targetId:'e',hitLocation});
 const n=order(prone,{type:'throwKnife',targetId:'e',hitLocation:'torso'});assert.equal(unit(n,'e').lastHitLocation,'torso');assert.ok(unit(n,'e').hp<100);
});

test('strength and energy set range, accuracy halves beyond nominal range, and a hard limit rejects farther throws',()=>{
 const s=field({strength:80,dexterity:80,agility:80,marksmanship:80,condition:80},[],{exploration:true}),p=unit(s);
 assert.deepEqual(knifeThrowRange(p),{nominal:8,maximum:16});assert.equal(knifeThrowChance(p,8),56);assert.equal(knifeThrowChance(p,9),27);
 const within=knifeThrowPreview(s,p,{x:18,y:3});assert.equal(within.valid,true);assert.ok(within.chance>0);assert.equal(knifeThrowPreview(s,p,{x:19,y:3}).valid,false);reject(s,{type:'throwKnife',x:19,y:3});
 assert.ok(knifeThrowRange({...p,energy:50}).maximum<16);assert.ok(knifeThrowChance({...p,condition:10},8)<knifeThrowChance(p,8));
});

test('stowed knives, wrong blades, mixed body zones and unaffordable actions reject without mutations',()=>{
 const cases=[
  field({weapon:1800,weaponInstanceId:'gun',blade:1813,bladeInstanceId:'knife-owned',bladeCondition:73,loaded:1}),
  field({weapon:1811,weaponInstanceId:'bayonet-owned'}),field({weapon:1810,weaponInstanceId:'sabre-owned'}),field({activeSlot:'unarmed'}),field({activeSlot:'medical',medkits:1}),field({mounted:true}),field({energy:5}),field({knockedDown:true}),
 ];
 for(const s of cases)reject(s,{type:'throwKnife',targetId:'e'});
 const s=field();for(const action of [{targetId:'missing'},{targetId:'p'},{x:2,y:3},{x:99,y:3},{x:4.5,y:3},{x:NaN,y:3},{x:4,y:3,tacticalLevel:1},{x:4,y:3,hitLocation:'head'},{targetId:'e',hitLocation:'arm'}])reject(s,{type:'throwKnife',...action});
 const short=field({stance:'prone',movementMode:'prone',facing:6});unit(short).ap=knifeThrowPreview(short,unit(short),{x:5,y:3},{aim:4}).pa-1;reject(short,{type:'throwKnife',x:5,y:3,aim:4});
 const noWindow=field();noWindow.phase='interrupt';noWindow.interrupt={unitIds:[]};reject(noWindow,{type:'throwKnife',targetId:'e'});
});

test('preparation pays for standing and turning before the separate throw without an AP refund',()=>{
 const s=field({stance:'prone',movementMode:'prone',facing:6}),p=unit(s),point={x:6,y:3},preview=knifeThrowPreview(s,p,point,{aim:2});
 assert.equal(preview.valid,true);assert.ok(preview.costs.stance>0);assert.ok(preview.costs.turn>0);const n=order(s,{type:'throwKnife',...point,aim:2});
 assert.equal(unit(n).stance,'standing');assert.equal(unit(n).facing,2);assert.equal(unit(n).ap,p.ap-preview.pa);assert.equal(unit(n).energy,p.energy-6);exactKnife(n,handRecord(p,'primary'));
});

test('new contact during standing or turning stops preparation with the knife still held',()=>{
 const wallEdges=[{id:'low-screen',x:3,y:3,axis:'y',type:'wall',material:'adobe',blocked:true,blocksSight:true,cover:40,obstacleHeight:.8}];
 const crouched=field({stance:'prone',movementMode:'prone'},[enemy()],{wallEdges,upperSurfaces:[roof(20)],exploration:true});assert.equal(crouched.mode,'exploration');assert.equal(canSee(crouched,unit(crouched),unit(crouched,'e')),false);
 const turned=field({facing:6},[enemy({facing:2})],{exploration:true});assert.equal(turned.mode,'exploration');
 for(const s of [crouched,turned]){
  const p=unit(s),n=order(s,{type:'throwKnife',x:5,y:3});assert.equal(n.mode,'combat');assert.equal(unit(n).stance,'standing');assert.equal(unit(n).facing,2);assert.equal(unit(n).weaponDropped,undefined);assert.equal(unit(n).weaponInstanceId,'knife-owned');assert.equal(n.groundItems.length,0);assert.equal(unit(n,'e').hp,100);assert.equal(unit(n).ap,p.ap);assert.equal(getKnifeThrowVisual(s,n),null);assert.ok(n.log.some(line=>line.includes('preparación se detuvo')));
 }
});

test('an actual enemy reaction during preparation spends its existing shot and leaves the knife unthrown',()=>{
 const wallEdges=[{id:'low-screen',x:3,y:3,axis:'y',type:'wall',material:'adobe',blocked:true,blocksSight:true,cover:40,obstacleHeight:.8}];
 const s=field({stance:'prone',movementMode:'prone',agility:0,wisdom:0,experienceLevel:1},[enemy({weapon:1805,loaded:1,ammo:0,activeSlot:'primary',marksmanship:100,agility:100,wisdom:100,experienceLevel:10,overwatch:true})],{wallEdges,upperSurfaces:[roof(20)]});
 // This preparation fixture grants one shot. The free floor beside the edge
 // must not also fund a later approach and counterattack with the held knife.
 unit(s,'e').ap=actionCosts(s,unit(s,'e'),unit(s)).fire;
 assert.equal(s.mode,'combat');assert.equal(canSee(s,unit(s,'e'),unit(s)),false);const knife=handRecord(unit(s),'primary');
 const n=order(s,{type:'throwKnife',x:5,y:3});assert.equal(unit(n).stance,'standing');assert.equal(unit(n,'e').reactionTurn,s.turn);assert.equal(unit(n,'e').loaded,0);assert.equal(unit(n,'e').ammo,0);assert.ok(unit(n,'e').ap<unit(s,'e').ap);assert.ok(unit(n).hp<unit(s).hp);assert.ok(unit(n).ap<unit(s).ap);
 assert.equal(exactKnife(n,knife).owner,'p');assert.equal(unit(n).weaponDropped,undefined);assert.equal(n.groundItems.length,0);assert.equal(getKnifeThrowVisual(s,n),null);assert.ok(n.log.some(line=>line.includes('preparación se detuvo')));
});

test('friendly interception stores the knife with the actual friend without damaging the selected enemy',()=>{
 const s=field(),friend={...structuredClone(unit(s)),id:'friend',x:4,weapon:0,weaponInstanceId:undefined,loaded:0,activeSlot:'unarmed'};s.units.push(friend);const knife=handRecord(unit(s),'primary');
 const preview=knifeThrowPreview(s,unit(s),unit(s,'e'));assert.equal(preview.valid,true);assert.equal(preview.chance,0);assert.equal(preview.flight.victimId,'friend');
 reject(s,{type:'throwKnife',targetId:'friend'});const n=order(s,{type:'throwKnife',targetId:'e'});assert.equal(unit(n,'e').hp,100);assert.ok(unit(n,'friend').hp<100);assert.equal(exactKnife(n,knife).owner,'friend');
});

test('the paid throw completes item transfer before its final energy expenditure incapacitates the thrower',()=>{
 const s=field({energy:6}),knife=handRecord(unit(s),'primary');const n=order(s,{type:'throwKnife',targetId:'e',aim:4});
 assert.equal(unit(n).energy,0);assert.equal(unit(n).unconscious,true);assert.equal(unit(n).hp,unit(s).hp);assert.equal(unit(n).weaponDropped,true);assert.equal(unit(n).weaponInstanceId,undefined);assert.notEqual(exactKnife(n,knife).owner,'p');assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(n))),n);
});

test('hidden living interception changes actual custody but cannot alter the public preview or throw visual',()=>{
 const tiles=floor();Object.assign(tiles[3*24+7],{type:'forest',cover:90,concealment:90});
 const s=field({},[enemy({x:8}),enemy({id:'hidden',x:7,stance:'crouched',movementMode:'crouch'})],{tiles,night:true}),p=unit(s),target=unit(s,'e');
 assert.equal(canSee(s,p,target),true);assert.equal(canSee(s,p,unit(s,'hidden')),false);
 const publicState={...s,units:s.units.filter(u=>u.id!=='hidden')},preview=knifeThrowPreview(s,p,target);assert.deepEqual(preview,knifeThrowPreview(publicState,p,target));assert.equal(preview.flight.victimId,'e');reject(s,{type:'throwKnife',targetId:'hidden'});
 const action={type:'throwKnife',targetId:'e'},n=order(s,action),publicResult=order(publicState,action);
 assert.equal(unit(n,'e').hp,100);assert.ok(unit(n,'hidden').hp<100);assert.equal(exactKnife(n,handRecord(p,'primary')).owner,'hidden');assert.deepEqual(getKnifeThrowVisual(s,n),getKnifeThrowVisual(publicState,publicResult));
});

test('a quiet roof throw gives only nearby unseen listeners an anonymous knife noise that survives validation',()=>{
 const upperSurfaces=[roof(2),roof(3),roof(4),roof(5)],s=field({tacticalLevel:1},[enemy({id:'under',x:2,tacticalLevel:0}),enemy({id:'far',x:5,tacticalLevel:0})],{upperSurfaces});
 assert.equal(noiseRadius('knife',unit(s)),2);assert.equal(canSee(s,unit(s,'under'),unit(s)),false);
 const n=order(s,{type:'throwKnife',x:5,y:3,tacticalLevel:1});assert.equal(unit(n,'under').lastHeardNoise.kind,'knife');assert.equal(unit(n,'far').lastHeardNoise,undefined);
 const report=unit(n,'under').lastHeardNoise;for(const key of ['id','unitId','sourceId','side','tacticalLevel','hp'])assert.equal(report[key],undefined,key);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(n))),n);
});

test('throw and recovery replay deterministically, preserve the input, and reject duplicate identity saves',()=>{
 const s=field(),before=structuredClone(s),action={type:'throwKnife',targetId:'e',aim:4},saved=validateBattleSnapshot(JSON.parse(JSON.stringify(s))),n=order(s,action);assert.deepEqual(order(saved,action),n);assert.deepEqual(s,before);
 const duplicate=structuredClone(n);unit(duplicate).inventory.copy={weapon:1813,count:1,weight:.6,condition:73,loaded:0,instanceId:'knife-owned'};assert.throws(()=>validateBattleSnapshot(duplicate),/identidad/);
 const ids=[...n.units.flatMap(heldItemIds),...n.units.flatMap(u=>Object.values(u.inventory).flatMap(fittingItemIds)),...n.groundItems.filter(g=>g.count>0).flatMap(fittingItemIds)];assert.equal(ids.filter(id=>id==='knife-owned').length,1);
});
