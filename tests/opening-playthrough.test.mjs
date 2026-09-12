import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign as dispatch,rosterFor} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,getReachable,hasLineOfSight,canSee,shotChance,actionCosts,interruptAvailable,stanceCost} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {handRecord} from '../game/tactical-inventory.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

const alive=u=>u.hp>0&&!u.departure&&!u.surrendered&&!u.unconscious&&!u.routed;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function combatOrder(b,u){
 const cost=actionCosts(b,u),players=b.units.filter(v=>v.side===u.side&&alive(v));
 if(u.knockedDown||u.entangled)return chooseEnemyAction(b,u);
 // Keep the mission commander in the firing line with the infantry.
 if(u.missionAlly&&u.mounted&&u.ap>=cost.mount)return {type:'mount',unitId:u.id};
 if(u.missionAlly&&u.stance!=='prone'&&u.ap>=stanceCost(u,'prone'))return {type:'stance',unitId:u.id,stance:'prone'};
 const visible=b.units.filter(v=>v.side!==u.side&&alive(v)&&players.some(p=>canSee(b,p,v)));
 const patient=b.units.filter(v=>v.side===u.side&&v.hp>0&&!v.departure&&!v.surrendered&&!v.routed&&v.bleeding>0&&distance(u,v)<=1.5&&hasLineOfSight(b,u,v)).sort((a,b)=>a.hp-b.hp)[0];
 if(patient&&u.medkits>0&&u.medical>0){
  if(u.activeSlot==='medical'&&u.ap>=cost.heal)return {type:'useItem',unitId:u.id,targetId:patient.id};
  if(u.activeSlot!=='medical'&&u.ap>=cost.heal+cost.weapon)return {type:'weapon',unitId:u.id,slot:'medical'};
 }
 if(['medical','tool','supply'].includes(u.activeSlot)&&u.ap>=cost.weapon)return {type:'weapon',unitId:u.id,slot:'primary'};
 if(u.jammed&&u.priming&&u.ap>=cost.reprime)return {type:'reprime',unitId:u.id};
 const target=visible.filter(t=>hasLineOfSight(b,u,t)).sort((a,c)=>shotChance(b,u,c,4)-shotChance(b,u,a,4))[0];
 if(target&&u.loaded&&!u.jammed&&u.ap>=cost.fire){
   if(u.stance!=='prone'&&!u.mounted&&u.ap>=cost.fire+cost.aim*2+6)return {type:'stance',unitId:u.id,stance:'prone'};
   const aim=Math.min(4,Math.floor((u.ap-cost.fire)/cost.aim));
   if(shotChance(b,u,target,aim)>=25)return {type:'fire',unitId:u.id,targetId:target.id,aim};
 }
 // Kneel when prone muzzle-loading is unaffordable but a complete
 // crouched reload fits. Do not leave an empty Baker waiting indefinitely.
 if(!u.loaded&&!u.jammed&&u.ammo&&u.stance==='prone'&&cost.reload>u.ap&&u.ap>=stanceCost(u,'crouched')+actionCosts(b,{...u,stance:'crouched'}).reload)return {type:'stance',unitId:u.id,stance:'crouched'};
 if(!u.loaded&&!u.jammed&&u.ammo&&cost.reload>0&&u.ap>=cost.reload)return {type:'reload',unitId:u.id};
 const automatic=chooseEnemyAction(b,u);
 if(u.missionAlly&&players.length>1&&automatic?.type==='move')return null;
 if(automatic&&automatic.type!=='charge')return automatic;
 if(u.missionAlly&&players.length>1)return null; // Infantry scouts first; a lone commander must still act.
 if(visible.length)return null;
 // Reconnaissance advances toward the known sector center in short bounds.
 const destination={x:Math.floor(b.width*.65),y:Math.floor(b.height*.5)};
 if(distance(u,destination)<=4)return null;
 if(u.stance!=='standing'&&u.ap>=6)return {type:'stance',unitId:u.id,stance:'standing'};
 const moves=getReachable(b,u).filter(p=>p.cost>0&&p.cost<=Math.min(40,u.ap-20)&&distance(p,destination)<distance(u,destination));
 moves.sort((a,c)=>distance(a,destination)-distance(c,destination)||a.cost-c.cost);
 return moves[0]?{type:'move',unitId:u.id,x:moves[0].x,y:moves[0].y}:null;
}
function fight(request){let b=enterSector(request),actions=0;
 // Enemy movement can yield several control windows within the same round.
 for(let window=0;window<600&&b.turn<=80&&b.status==='active';window++){
  const ids=b.units.filter(u=>u.side==='player').sort((a,c)=>c.marksmanship-a.marksmanship).map(u=>u.id);
  for(const id of ids)for(let attempt=0;attempt<16&&b.status==='active';attempt++){
   const u=b.units.find(u=>u.id===id);if(!interruptAvailable(b,u)||u.ap<3)break;
   const action=combatOrder(b,u);if(!action)break;
   const next=actBattle(b,action);assert.equal(next.lastError,null,JSON.stringify(action));b=next;actions++;
  }
  if(b.status==='active')b=endTurn(b);
 }
 return {battle:b,actions};
}
const tacticalOrder=(b,action)=>{const next=actBattle(b,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};

test('legal authored-map opening campaign wins San Nicolás then San Lorenzo',()=>{
 // Keep this seed and the actual casualties as maps and tactical rules evolve.
 let c=initialCampaign(8);const transcript=[],casualties=new Set();
 const order=a=>{c=dispatch(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+': '+c.lastError);};
 const waitFor=hours=>{
  const until=c.hour+hours;
  // Assignment notices stop a requested wait. Deliberately continue the
  // remaining rest/care time through ordinary orders, without changing clocks.
  for(let attempt=0;c.hour<until&&attempt<100;attempt++){
   const before=c.hour;order({type:'wait',hours:until-c.hour});
   assert.ok(c.hour>before||c.assignmentAttention.notice,'an interrupted wait must explain its zero-hour stop');
  }
  assert.equal(c.hour,until,'the planned recovery interval actually elapses');
 };
 order({type:'createOfficer',name:'Inés del Norte',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
 for(const id of [110,114,115,123,107])order({type:'recruitCivic',id,term:'week'});
 assert.equal(c.squad.length,6);order({type:'purchaseMedicalSupplies',operativeId:107,quantity:20});
 order({type:'academy'});order({type:'travel',sector:'buenos_aires'});
 // Sleep through staging until departure at midnight, then make the real
 // twelve-hour approach for a daylight battle. Notices may pause the wait.
 for(const operativeId of c.squad)order({type:'setSleep',operativeId,asleep:true});
 waitFor(12);
 let dressingBearer=115;
 for(const sector of ['san_nicolas','san_lorenzo']){
  if(sector==='san_lorenzo'){
   let doctor=c.recruited.find(id=>c.operativeState[id].alive&&rosterFor(c).find(o=>o.id===id).medical>=70);
   const patients=c.squad.filter(id=>id!==doctor&&c.operativeState[id].hp<c.operativeState[id].maxHp);
   // A dead doctor stays dead; a critical doctor cannot work. A paid relief
   // medic uses the finite dressings recovered from the first battlefield.
   if(!doctor||c.operativeState[doctor].hp<15||c.operativeState[doctor].bleeding){
    const originalDoctor=doctor;
    const relief=116;
    order({type:'recruitCivic',id:relief,term:'week'});
    // San Nicolás has no medical shop. Revisit the cleared field and hand the
    // relief medic the remaining dressings recovered during immediate aid.
    order({type:'visitSector'});
    let visit=enterSector(c.pendingBattle,c.sectorStates[c.location]);
    const helper=visit.units.find(u=>u.id===String(relief)),donor=visit.units.find(u=>u.id===String(dressingBearer));
    const place=getReachable(visit,helper).filter(p=>distance(p,donor)<=1.5&&hasLineOfSight(visit,p,donor)).sort((a,b)=>a.cost-b.cost)[0];
    assert.ok(place,'the relief medic can reach the soldier carrying the dressings');
    if(place.cost)visit=tacticalOrder(visit,{type:'move',unitId:helper.id,x:place.x,y:place.y});
    const quantity=donor.medkits;assert.ok(quantity>=6,'field supplies are sufficient for critical care');
    visit=tacticalOrder(visit,{type:'transfer',unitId:donor.id,targetId:helper.id,item:'medkits',count:quantity});
    order({type:'leaveSector',battleId:c.pendingBattle.id,survivors:visit.units.filter(u=>u.side==='player'),sectorState:visit});
    assert.equal(c.operativeState[dressingBearer].medkits,0);
    assert.equal(c.operativeState[relief].medkits,helper.medkits+quantity);
    order({type:'assignCare',operativeId:relief,assignment:'doctor'});
    for(const id of c.squad)if(id!==relief)order({type:'assignCare',operativeId:id,assignment:c.operativeState[id].hp<c.operativeState[id].maxHp?'patient':'rest'});
    waitFor(6);
    if(originalDoctor){
     assert.ok(c.operativeState[originalDoctor].alive&&c.operativeState[originalDoctor].hp>=15,'paid relief care stabilizes the original doctor');
     assert.equal(c.operativeState[originalDoctor].bleeding,0);
     order({type:'assignCare',operativeId:relief,assignment:'rest'});
    }else doctor=relief;
   }else{
    for(const id of c.squad)order({type:'assignCare',operativeId:id,assignment:'rest'});
    waitFor(6);
   }
   if(patients.length){
    const rested=Object.fromEntries(patients.map(id=>[id,c.operativeState[id].hp])),kits=c.operativeState[doctor].medkits;
    order({type:'assignCare',operativeId:doctor,assignment:'doctor'});
    for(const id of c.squad)if(id!==doctor&&c.operativeState[id].hp<c.operativeState[id].maxHp)order({type:'assignCare',operativeId:id,assignment:'patient'});
    waitFor(18);
    assert.ok(patients.some(id=>c.operativeState[id].hp>rested[id]),'hourly doctor treatment restores battlefield injuries');
    assert.ok(c.operativeState[doctor].medkits<kits,'medical recovery consumes purchased supplies');
   }
   for(const id of c.squad)order({type:'assignCare',operativeId:id,assignment:'active'});
   // Survivors with broken morale recuperate in reserve. Replacements have
   // ordinary paid contracts and bring their normal equipment and supplies.
   const combatSquad=c.activeSquadId,reserve=c.squad.filter(id=>c.operativeState[id].morale<40);
   if(reserve.length){
    order({type:'createSquad',name:'Reserva de recuperación',ids:reserve});
    for(const id of reserve)order({type:'assignCare',operativeId:id,assignment:'rest'});
    order({type:'selectSquad',id:combatSquad});
   }
   for(const id of [131,137,113,124,116,117]){
    if(c.squad.length>=6)break;
    if(!c.recruited.includes(id))order({type:'recruitCivic',id,term:'week'});
   }
   assert.equal(c.squad.length,6,'paid replacements restore the combat squad');
   // The replacement squad has short cavalry weapons. Recover the fallen
   // infantry's finite rifles, keeping each replaced gun in its owner's pack.
   order({type:'visitSector'});
   let salvage=enterSector(c.pendingBattle,c.sectorStates[c.location]);
   // Tactical changes can leave former casualties alive. Salvage actual fallen
   // riflemen for the actual replacements, without inventing deaths or guns.
   const sources=salvage.units.filter(u=>u.side==='player'&&u.hp===0&&!u.weaponDropped&&[1800,1801,1802].includes(u.weapon));
   const receivers=salvage.units.filter(u=>u.side==='player'&&u.hp>0&&[131,137,113,124,116,117].includes(Number(u.id)));
   assert.ok(sources.length&&receivers.length,'a real casualty and a paid replacement support the salvage check');
   for(const [index,source] of sources.slice(0,receivers.length).entries()){
    const receiverId=receivers[index].id;
    let receiver=salvage.units.find(u=>u.id===String(receiverId));
    assert.ok(receiver&&source?.hp===0,'the replacement and fallen rifleman are present');
    const incoming=handRecord(source,'primary'),outgoing=handRecord(receiver,'primary');
    const approach=getReachable(salvage,receiver).filter(p=>distance(p,source)<=1.5&&hasLineOfSight(salvage,p,source)).sort((a,b)=>a.cost-b.cost)[0];
    assert.ok(approach,'the replacement can reach the fallen rifleman');
    if(approach.cost)salvage=tacticalOrder(salvage,{type:'move',unitId:receiver.id,x:approach.x,y:approach.y});
    salvage=tacticalOrder(salvage,{type:'loot',unitId:receiver.id,targetId:source.id,item:'primary',count:1});
    receiver=salvage.units.find(u=>u.id===String(receiverId));
    const entries=Object.entries(receiver.inventory).filter(([key,item])=>item.weapon===source.weapon);
    assert.equal(entries.length,1,'the recovered firearm has one inventory record');
    const entry=entries[0];assert.equal(entry[1].count,1,'only one firearm was recovered');
    salvage=tacticalOrder(salvage,{type:'equipLoot',unitId:receiver.id,inventoryKey:entry[0]});
    const equipped=salvage.units.find(u=>u.id===receiver.id),looted=salvage.units.find(u=>u.id===source.id);
    assert.deepEqual(handRecord(equipped,'primary'),incoming,'the recovered rifle retains its load, condition and identity');
    assert.deepEqual(Object.values(equipped.inventory).find(item=>item.weapon===outgoing.weapon),outgoing,'the original gun and loaded round remain in the pack');
    assert.equal(looted.weaponDropped,true);assert.equal(looted.loaded,0);assert.equal(looted.ammo,source.ammo);
   }
   order({type:'leaveSector',battleId:c.pendingBattle.id,survivors:salvage.units.filter(u=>u.side==='player'),sectorState:salvage});
   const saved=decodeSave(encodeSave(c,null));assert.deepEqual(saved.campaign,c,'salvaged equipment and stripped bodies survive a campaign save');c=saved.campaign;

  }
  // San Lorenzo is local. Wait through darkness before starting its assault.
  if(sector==='san_lorenzo'&&(c.hour%24<6||c.hour%24>=20))waitFor((30-c.hour%24)%24);
  order({type:'attack',sector});const request=c.pendingBattle;
  const entry=enterSector(request);
  assert.equal(entry.startSeconds,c.hour*3600+(c.secondOfHour??0),'combat starts at the actual arrival time');
  assert.equal(entry.night,false,'ordinary departure and wait orders schedule daylight assaults');
  let {battle:b,actions}=fight(request);
  assert.deepEqual(b,fight(request).battle,'identical seed and legal orders replay deterministically');
  assert.ok(actions>0);assert.ok(b.turn>1);
  assert.ok(b.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+u.loaded+u.ammo,0)<request.issuedCartridges+(request.missionAllies??[]).reduce((sum,u)=>sum+u.loaded+u.ammo,0),'actual shots consume issued cartridges');
  transcript.push({sector,startSeconds:b.startSeconds,status:b.status,turn:b.turn,actions,units:b.units.map(u=>({id:u.id,hp:u.hp,energy:u.energy,ammo:u.ammo,loaded:u.loaded,routed:u.routed}))});
  assert.equal(b.status,'victory',JSON.stringify(transcript));
  if(sector==='san_nicolas'){
   // Recover finite dressings from the fallen doctor after an actual approach.
   // Aid treats surviving casualties; it cannot revive someone already dead.
   b=tacticalOrder(b,{type:'explore'});
   b=autoBandageBattle(b).battle;
   const doctor=b.units.find(u=>u.id==='107');
   if(doctor.hp<=0||doctor.unconscious){
    const candidates=b.units.filter(u=>u.side==='player'&&u.id!==doctor.id&&u.hp>=15&&!u.unconscious&&!u.routed).flatMap(bearer=>getReachable(b,bearer).filter(p=>distance(p,doctor)<=1.5&&hasLineOfSight(b,p,doctor)).map(approach=>({bearer,approach}))).sort((a,b)=>a.approach.cost-b.approach.cost);
    const {bearer,approach}=candidates[0]??{};if(bearer)dressingBearer=Number(bearer.id);
    assert.ok(approach,'the surviving rifleman can reach the fallen doctor');
    if(approach.cost)b=tacticalOrder(b,{type:'move',unitId:bearer.id,x:approach.x,y:approach.y});
    b=tacticalOrder(b,{type:'loot',unitId:String(dressingBearer),targetId:'107',item:'medkits',count:10});
   } // A conscious surviving doctor keeps his supplies for actual patient care.
   const aid=autoBandageBattle(b);
   assert.deepEqual(aid.untreated,[],'immediate aid stops every surviving field hemorrhage');
   b=aid.battle;
   if(doctor.hp<=0)assert.equal(b.units.find(u=>u.id==='107').hp,0,'medical aid cannot revive the doctor');
   console.log('Opening immediate aid:',JSON.stringify(b.units.filter(u=>u.side==='player').map(u=>({id:u.id,hp:u.hp,bleeding:u.bleeding,medkits:u.medkits,energy:u.energy,ap:u.ap}))));
  }
  const synchronized=syncBattleTime(c,b);assert.equal(synchronized.error,null);
  const restored=decodeSave(encodeSave(synchronized.campaign,synchronized.battle));c=restored.campaign;b=restored.battle;
  for(const u of b.units.filter(u=>u.side==='player'&&!u.missionAlly&&u.hp<=0))casualties.add(Number(u.id));
  order({type:'battleResult',battleId:request.id,outcome:'victory',survivors:b.units.filter(u=>u.side==='player'),sectorState:b});
  for(const id of casualties){assert.equal(c.operativeState[id].alive,false);assert.ok(!c.squad.includes(id));}
 }
 assert.ok(c.resources.treasury>=0);assert.equal(c.phase,2,JSON.stringify(transcript));assert.equal(c.flags.sanLorenzo,true);
 console.log('Opening playthrough:',JSON.stringify(transcript));
});
