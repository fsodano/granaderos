import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {deploymentMorale,validateMorale} from '../game/morale.js';
import {contractQuote} from '../game/contracts.js';
import {enterSector} from '../game/world.js';
import {createBattle,actBattle,shotChance,presentedActBattle} from '../game/tactical.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {totalReserveAmmunition} from '../game/ammunition-types.js';
import {strategicBleedingPercent} from '../game/campaign-care-rules.js';

const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const now=s=>s.hour*3600+(s.secondOfHour??0);
const advanceTo=(s,target)=>{for(let i=0;i<160&&now(s)<target;i++)s=order(s,{type:'advanceStrategicTime',seconds:Math.min(3600,target-now(s))});assert.equal(now(s),target);return s;};
const saved=(s,b=null)=>decodeSave(encodeSave(s,b));
const paidPair=(content=defaultContentPackage(),term='week')=>{
 let s=initialCampaign(42,content);for(const id of [107,116]){const quote=contractQuote(s,rosterFor(s).find(o=>o.id===id),id===116?term:'week'),cash=s.resources.treasury;s=order(s,{type:'recruitCivic',id,term:id===116?term:'week'});assert.equal(s.resources.treasury,cash-quote.price);}
 s=advanceTo(s,21600);assert.deepEqual(s.recruited,[107,116]);return saved(s).campaign;
};
const issued=s=>s.pendingBattle.squad.find(u=>u.id===107);
const checkpoint=(s,b)=>{
 s=order(s,{type:'syncTacticalTime',battleId:s.pendingBattle.id,elapsedSeconds:b.elapsedSeconds,sectorState:b});b={...b,syncedSeconds:b.elapsedSeconds};
 const restored=saved(s,b);assert.deepEqual(restored.campaign,s);assert.deepEqual(restored.battle,b);return restored;
};
const leave=(s,b)=>order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
const noSupport=u=>{assert.equal(Object.hasOwn(u,'companionBonus'),false);assert.equal(Object.hasOwn(u,'companionId'),false);};
const lossLetters=s=>(s.correspondence??[]).filter(m=>m.id.startsWith('companion-loss:'));
const griefLine='Inés Aguirre lamenta la muerte de Petrona Lagos. Moral −6.';
const assertLossLetter=s=>{
 const messages=lossLetters(s);assert.equal(messages.length,1);
 assert.deepEqual(messages[0],{id:'companion-loss:107:116',sender:'Inés Aguirre',subject:'Una pérdida en el destacamento',text:'Lamento la muerte de Petrona Lagos. Confiaba en su ayuda.',hour:s.operativeState[116].deathMinute===undefined?s.hour:Math.floor(s.operativeState[116].deathMinute/60),received:true});
 return structuredClone(messages[0]);
};
const tactical=(p,action)=>{
 const actual=actBattle(p.battle,action);assert.equal(actual.lastError,null,JSON.stringify(action));assert.deepEqual(presentedActBattle(p.battle,action).state,actual);
 return checkpoint(p.campaign,actual);
};
const replayVisit=(initial,actions)=>{
 const s=order(saved(initial).campaign,{type:'visitSector'});let p=checkpoint(s,enterSector(s.pendingBattle,s.sectorStates.retiro));
 for(const action of actions)p=tactical(p,action);return p;
};

test('real paid companions improve a normal shot and retain only personal morale after saved physical returns',()=>{
 let s=paidPair();const cash=s.resources.treasury,quote=contractQuote(s,rosterFor(s).find(o=>o.id===107),'day');s=order(s,{type:'renewContract',id:107,term:'day'});assert.equal(s.resources.treasury,cash-quote.price);assert.equal(s.operativeState[107].morale,82);
 const before=structuredClone(s);s=order(s,{type:'visitSector'});assert.deepEqual({personal:issued(s).personalMorale,morale:issued(s).morale,cohesion:issued(s).cohesionBonus,bonus:issued(s).companionBonus,id:issued(s).companionId},{personal:82,morale:85,cohesion:0,bonus:3,id:116});noSupport(s.pendingBattle.squad.find(u=>u.id===116));
 // An ordinary arena uses the actually owned issue, not stronger authored gear.
 const actor=issued(s),companion=s.pendingBattle.squad.find(u=>u.id===116),neutral=deploymentMorale(before,107,[107]);
 const arena=morale=>createBattle([{...actor,morale,x:1,y:3,facing:2},{...companion,x:1,y:6}],{width:12,height:8,seed:11,hour:12,enemies:[{id:'target',x:4,y:3,stance:'standing',overwatch:false}]});
 const supported=arena(actor.morale),alone=arena(neutral.morale);assert.equal(shotChance(alone,alone.units[0],alone.units[2]),56);assert.equal(shotChance(supported,supported.units[0],supported.units[2]),57);
 const action={type:'fire',unitId:'107',targetId:'target'},actual=actBattle(supported,action),presented=presentedActBattle(supported,action);assert.equal(actual.lastError,null);assert.deepEqual(presented.state,actual);assert.equal(actual.units[0].loaded,actor.loaded-1);assert.equal(actual.elapsedSeconds,6);assert.ok(actual.units[0].ap<supported.units[0].ap);assert.equal(actual.units[2].hp,60);
 const neutralShot=actBattle(alone,action);assert.equal(neutralShot.units[0].ap,actual.units[0].ap);assert.equal(neutralShot.elapsedSeconds,actual.elapsedSeconds);assert.equal(neutralShot.seed,actual.seed);
 for(let i=0;i<3;i++){
  let b=enterSector(s.pendingBattle,s.sectorStates.retiro),p=b.units.find(u=>u.id==='107');const look={type:'look',unitId:p.id,x:p.x+1,y:p.y};const original=actBattle(b,look);
  ({campaign:s,battle:b}=checkpoint(s,b));b=actBattle(b,look);assert.deepEqual(b,original);({campaign:s,battle:b}=checkpoint(s,b));const request=s.pendingBattle,contracts=structuredClone(s.contracts),money=s.resources.treasury;
  s=leave(s,b);assert.equal(s.operativeState[107].morale,82);assert.equal(s.operativeState[116].morale,80);assert.deepEqual(s.contracts,contracts);assert.equal(s.resources.treasury,money);assert.deepEqual(saved(s).campaign,s);
  const stale=dispatchCampaign(s,{type:'leaveSector',battleId:request.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.ok(stale.lastError);assert.deepEqual({...stale,lastError:null},s);
  if(i<2)s=order(s,{type:'visitSector'});
 }
});

test('only actual initial participants give support, including another squad in a coordinated assault',()=>{
 let s=paidPair();s=order(s,{type:'createSquad',name:'Reserva',ids:[116]});s=order(s,{type:'selectSquad',id:'squad-1'});
 const solo=order(s,{type:'visitSector'});noSupport(issued(solo));assert.equal(issued(solo).morale,80);
 s=order(s,{type:'selectSquad',id:'squad-2'});s=order(s,{type:'attack',sector:'buenos_aires',queue:true});s=order(s,{type:'selectSquad',id:'squad-1'});
 const traveling=order(s,{type:'visitSector'});noSupport(issued(traveling));assert.equal(traveling.pendingBattle.squad.length,1);
 s=order(s,{type:'attack',sector:'buenos_aires',queue:true});s=advanceTo(s,18*3600);assert.ok(s.squads.every(q=>q.journey?.status==='ready'));s=order(s,{type:'beginAssault',sector:'buenos_aires'});
 assert.equal(s.pendingBattle.assaultSquads.length,2);assert.equal(issued(s).cohesionBonus,0);assert.equal(issued(s).companionBonus,3);assert.equal(issued(s).companionId,116);
 assert.deepEqual(saved(s,enterSector(s.pendingBattle)).campaign,s);
});

test('awake and capable support is checked at issue and applies to real local defense participants',()=>{
 const tired=defaultContentPackage(),def=tired.characters.find(c=>c.id==='person-116');def.startingCondition={hp:def.attributes.maxHp,energy:99,fatigue:0,bleeding:0,bandaged:0};let s=paidPair(tired);s=order(s,{type:'setSleep',operativeId:116,asleep:true});const denied=dispatchCampaign(s,{type:'visitSector'});assert.match(denied.lastError,/durmiendo/);assert.deepEqual({...denied,lastError:null},s);noSupport(deploymentMorale(s,107,[107,116]));s=order(s,{type:'squad',ids:[107]});const sleeping=order(s,{type:'visitSector'});noSupport(issued(sleeping));
 for(const condition of [{hp:14,energy:100},{hp:def.attributes.maxHp,energy:0}]){const d=defaultContentPackage(),c=d.characters.find(c=>c.id==='person-116');c.startingCondition={...condition,fatigue:0,bleeding:0,bandaged:0};let state=paidPair(d);noSupport(deploymentMorale(state,107,[107,116]));if(condition.energy===0){const blocked=dispatchCampaign(state,{type:'visitSector'});assert.match(blocked.lastError,/durmiendo|descansar/);assert.deepEqual({...blocked,lastError:null},state);state=order(state,{type:'squad',ids:[107]});}const visit=order(state,{type:'visitSector'});noSupport(issued(visit));}
 s=paidPair();s=order(s,{type:'createSquad',name:'Reserva',ids:[116]});launchEnemyGroup(s,'interior','retiro',{immediate:true});s=advanceTo(s,now(s)+1);assert.ok(s.pendingEncounter);s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'tactical'});assert.equal(s.pendingBattle.squad.length,2);assert.equal(issued(s).companionId,116);assert.equal(issued(s).companionBonus,3);assert.deepEqual(saved(s,enterSector(s.pendingBattle)).campaign,s);
});

test('earned cohesion keeps priority, preferences never stack, and the applied support respects both caps',()=>{
 for(const [hours,cohesion,bonus] of [[48,2,3],[72,3,2],[120,5,0]]){let s=paidPair();s=advanceTo(s,(6+hours)*3600);s=order(s,{type:'visitSector'});assert.equal(issued(s).cohesionBonus,cohesion);assert.equal(issued(s).morale,85);if(bonus)assert.equal(issued(s).companionBonus,bonus);else noSupport(issued(s));}
 const s=paidPair(); // Isolated cap admission, not an additional campaign payment.
 for(const personal of [98.5,100]){const capped=structuredClone(s);capped.operativeState[107].morale=personal;const receipt=deploymentMorale(capped,107,[107,116]);assert.equal(receipt.morale,100);assert.equal(receipt.cohesionBonus,0);if(personal<100)assert.equal(receipt.companionBonus,1.5);else noSupport(receipt);}
 const d=defaultContentPackage();d.characters.find(c=>c.id==='person-107').preferredCompanions.push({character:'person-103',reason:'Otra preferencia ficticia.'});let pair=paidPair(d);pair=order(pair,{type:'recruitCivic',id:103,term:'day'});pair=advanceTo(pair,12*3600);pair=order(pair,{type:'visitSector'});assert.equal(issued(pair).companionBonus,3);assert.equal(issued(pair).companionId,116);
});

test('real paid observed companion death preserves grief and one saved letter through corpse reentries',t=>{
 let s=paidPair();const hirePrices=Object.fromEntries([107,116].map(id=>[id,s.contracts[id].paid])),quote=contractQuote(s,rosterFor(s).find(o=>o.id===107),'day'),cash=s.resources.treasury;
 s=order(s,{type:'renewContract',id:107,term:'day'});assert.equal(s.resources.treasury,cash-quote.price);const initial=structuredClone(s);s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle),buddy=b.units.find(u=>u.id==='116');
 ({campaign:s,battle:b}=checkpoint(s,b));const before=structuredClone(b),firstShot={type:'firePoint',unitId:'107',x:buddy.x,y:buddy.y,aim:4};
 // Legal point fire can harm anyone in its ray; this spends one owned charge.
 ({campaign:s,battle:b}=tactical({campaign:s,battle:b},firstShot));assert.equal(b.units.find(u=>u.id==='107').loaded,0);assert.equal(b.units.find(u=>u.id==='116').hp,32);const wounded=saved(s,b);assert.equal(lossLetters(s).length,0);
 for(let i=0;i<40&&b.units.find(u=>u.id==='116').hp>=15;i++){const p=b.units.find(u=>u.id==='107');({campaign:s,battle:b}=tactical({campaign:s,battle:b},{type:'look',unitId:p.id,x:p.x+(i%2?-1:1),y:p.y}));}
 buddy=b.units.find(u=>u.id==='116');assert.equal(buddy.hp,14);assert.equal(buddy.unconscious,true);({campaign:s,battle:b}=checkpoint(s,b));assert.equal(issued(s).companionBonus,3);assert.equal(issued(s).companionId,116);
 const criticalReturn=leave(s,b);assert.equal(criticalReturn.operativeState[116].hp,14);assert.equal(criticalReturn.operativeState[107].morale,82);assert.equal(criticalReturn.operativeState[107].companionGrief,undefined);assert.equal(lossLetters(criticalReturn).length,0);assert.deepEqual(saved(criticalReturn).campaign,criticalReturn);
 ({campaign:s,battle:b}=wounded);const reload={type:'reload',unitId:'107'};({campaign:s,battle:b}=tactical({campaign:s,battle:b},reload));buddy=b.units.find(u=>u.id==='116');const secondShot={type:'firePoint',unitId:'107',x:buddy.x,y:buddy.y,aim:4};({campaign:s,battle:b}=tactical({campaign:s,battle:b},secondShot));assert.equal(b.units.find(u=>u.id==='116').hp,0);assert.equal(b.units.find(u=>u.id==='107').morale,61);assert.deepEqual(b.units.find(u=>u.id==='107').companionGrief,[{companionId:116,loss:6}]);assert.equal(b.log.filter(line=>line===griefLine).length,1);assert.equal(issued(s).companionBonus,3);assert.equal(lossLetters(s).length,0,'an unreturned tactical casualty has no delivered letter');
 const replay=replayVisit(initial,[firstShot,reload,secondShot]);assert.deepEqual(replay,{campaign:s,battle:b});const request=structuredClone(s.pendingBattle),finalBattle=structuredClone(b),seed=s.seed;
 const actor=b.units.find(u=>u.id==='107'),issuedActor=before.units.find(u=>u.id==='107');assert.equal(actor.loaded+totalReserveAmmunition(actor),issuedActor.loaded+totalReserveAmmunition(issuedActor)-2);assert.equal(actor.condition,issuedActor.condition-2);assert.equal(actor.ap,issuedActor.ap,'ordinary exploration pays real time while retaining its AP budget');assert.ok(b.elapsedSeconds>before.elapsedSeconds);
 s=leave(s,b);assert.deepEqual(leave(replay.campaign,replay.battle),s);assert.equal(s.operativeState[107].morale,52,'remove initial support once, retain the real tactical, grief and ordinary casualty losses');assert.deepEqual(s.operativeState[107].companionGrief,[{companionId:116,loss:6}]);assert.equal(s.operativeState[116].alive,false);assert.equal(s.operativeState[116].hp,0);assert.equal(s.resources.treasury,initial.resources.treasury);assert.equal(s.seed,seed);const letter=assertLossLetter(s);assert.deepEqual(saved(s).campaign,s);
 const stale=dispatchCampaign(s,{type:'leaveSector',battleId:request.id,sectorState:finalBattle,survivors:finalBattle.units.filter(u=>u.side==='player')});assert.ok(stale.lastError);assert.deepEqual({...stale,lastError:null},s);
 for(let i=0;i<2;i++){
  s=order(saved(s).campaign,{type:'visitSector'});noSupport(issued(s));b=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(b.units.find(u=>u.id==='116').hp,0,'the actual corpse stays in the scene');({campaign:s,battle:b}=checkpoint(s,b));assert.deepEqual(lossLetters(s),[letter]);const p=b.units.find(u=>u.id==='107');({campaign:s,battle:b}=tactical({campaign:s,battle:b},{type:'look',unitId:p.id,x:p.x+(p.facing===2?-1:1),y:p.y}));assert.equal(b.log.includes(griefLine),false,'a retained corpse cannot produce another named grief event');
  s=leave(s,b);assert.equal(s.operativeState[107].morale,52);assert.deepEqual(s.operativeState[107].companionGrief,[{companionId:116,loss:6}]);assert.equal(s.operativeState[116].alive,false);assert.equal(s.operativeState[107].carriedAmmo,actor.loaded+totalReserveAmmunition(actor));assert.deepEqual(lossLetters(saved(s).campaign),[letter]);
 }
 t.diagnostic(JSON.stringify({hirePrices,renewalPrice:quote.price,treasury:s.resources.treasury,orders:3,actionSeconds:finalBattle.elapsedSeconds,rounds:actor.loaded+totalReserveAmmunition(actor),weaponCondition:actor.condition,seed:finalBattle.seed,returnedMorale:s.operativeState[107].morale,letter}));
});

test('native paid tactical bleeding admits one observed grief loss without inventing a direct-hit death penalty',t=>{
 let s=order(paidPair(),{type:'renewContract',id:107,term:'day'});const initial=structuredClone(s);s=order(s,{type:'visitSector'});let pair=checkpoint(s,enterSector(s.pendingBattle)),before=structuredClone(pair),buddy=pair.battle.units.find(u=>u.id==='116');
 const actions=[{type:'firePoint',unitId:'107',x:buddy.x,y:buddy.y,aim:4}];pair=tactical(pair,actions[0]);assert.equal(pair.battle.units.find(u=>u.id==='116').hp,32);assert.equal(pair.battle.units.find(u=>u.id==='107').companionGrief,undefined);
 // Ordinary look orders turn north and back toward the wounded companion.
 // The live wound clock determines the fatal tick; no health is assigned.
 for(let i=0;i<80&&pair.battle.units.find(u=>u.id==='116').hp>0;i++){
  const actor=pair.battle.units.find(u=>u.id==='107'),companion=pair.battle.units.find(u=>u.id==='116');
  const action={type:'look',unitId:actor.id,x:companion.x,y:i%2?companion.y:actor.y-1};actions.push(action);pair=tactical(pair,action);
  if(pair.battle.units.find(u=>u.id==='116').hp>0){assert.equal(pair.battle.units.find(u=>u.id==='107').companionGrief,undefined);assert.equal(pair.battle.units.find(u=>u.id==='107').morale,85);}
 }
 const actor=pair.battle.units.find(u=>u.id==='107'),dead=pair.battle.units.find(u=>u.id==='116');assert.equal(dead.hp,0);assert.equal(actor.morale,79,'bleeding adds the observed six-point grief only; it does not add the direct-hit eighteen-point loss');assert.deepEqual(actor.companionGrief,[{companionId:116,loss:6}]);assert.equal(pair.battle.log.filter(line=>line===griefLine).length,1);assert.equal(lossLetters(pair.campaign).length,0);
 assert.equal(actor.hp,before.battle.units.find(u=>u.id==='107').hp);assert.equal(actor.loaded+totalReserveAmmunition(actor),9);assert.equal(actor.condition,99);assert.equal(pair.battle.seed,955863294);assert.equal(pair.campaign.resources.treasury,initial.resources.treasury);assert.deepEqual(replayVisit(initial,actions),pair);
 const request=structuredClone(pair.campaign.pendingBattle),finalBattle=structuredClone(pair.battle);s=leave(pair.campaign,pair.battle);assert.equal(s.operativeState[107].morale,70);assert.deepEqual(s.operativeState[107].companionGrief,[{companionId:116,loss:6}]);assert.equal(s.operativeState[116].alive,false);const letter=assertLossLetter(s);assert.deepEqual(saved(s).campaign,s);
 const stale=dispatchCampaign(s,{type:'leaveSector',battleId:request.id,sectorState:finalBattle,survivors:finalBattle.units.filter(u=>u.side==='player')});assert.ok(stale.lastError);assert.deepEqual({...stale,lastError:null},s);
 for(let i=0;i<2;i++){
  s=order(saved(s).campaign,{type:'visitSector'});let b=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(b.units.find(u=>u.id==='116').hp,0);({campaign:s,battle:b}=checkpoint(s,b));const p=b.units.find(u=>u.id==='107');({campaign:s,battle:b}=tactical({campaign:s,battle:b},{type:'look',unitId:p.id,x:p.x+(p.facing===2?-1:1),y:p.y}));assert.equal(b.log.includes(griefLine),false);s=leave(s,b);
  assert.equal(s.operativeState[107].morale,70);assert.deepEqual(s.operativeState[107].companionGrief,[{companionId:116,loss:6}]);assert.deepEqual(lossLetters(s),[letter]);assert.equal(s.operativeState[107].carriedAmmo,9);assert.equal(s.operativeState[107].condition,99);
 }
 t.diagnostic(JSON.stringify({scenario:'Native paid Retiro visit; actual untreated tactical wound, not a prepared victory',treasury:s.resources.treasury,tacticalOrders:actions.length,actionSeconds:finalBattle.elapsedSeconds,rounds:9,weaponCondition:actor.condition,seed:finalBattle.seed,tacticalMorale:actor.morale,returnedMorale:s.operativeState[107].morale,grief:actor.companionGrief,letter}));
});

test('a native paid companion dies from the real untreated wound once through saved hourly and batched waiting',t=>{
 let s=order(paidPair(),{type:'renewContract',id:107,term:'day'});const initial=structuredClone(s);s=order(s,{type:'visitSector'});let p=checkpoint(s,enterSector(s.pendingBattle)),buddy=p.battle.units.find(u=>u.id==='116'),actions=[{type:'firePoint',unitId:'107',x:buddy.x,y:buddy.y,aim:4}];
 p=tactical(p,actions[0]);for(let i=0;i<40&&p.battle.units.find(u=>u.id==='116').hp>=15;i++){const actor=p.battle.units.find(u=>u.id==='107'),action={type:'look',unitId:actor.id,x:actor.x+(i%2?-1:1),y:actor.y};actions.push(action);p=tactical(p,action);}
 buddy=p.battle.units.find(u=>u.id==='116');assert.equal(buddy.hp,14);assert.ok(buddy.bleeding>0);assert.equal(lossLetters(p.campaign).length,0);assert.deepEqual(replayVisit(initial,actions),p);
 s=leave(p.campaign,p.battle);assert.equal(s.pendingBattle,null);assert.equal(s.operativeState[116].alive,true);assert.equal(s.operativeState[107].morale,82);assert.equal(lossLetters(s).length,0);const returned=saved(s).campaign,ammo=returned.operativeState[107].carriedAmmo,condition=returned.operativeState[107].condition,seed=returned.seed,cash=returned.resources.treasury;
 const loss=Math.ceil(returned.operativeState[116].bleeding*strategicBleedingPercent(returned)/100),hours=Math.ceil(returned.operativeState[116].hp/loss);assert.ok(loss>0&&hours<24);
 const batch=order(saved(returned).campaign,{type:'wait',hours});for(let i=0;i<hours;i++){s=order(saved(s).campaign,{type:'wait',hours:1});if(i<hours-1){assert.equal(s.operativeState[116].alive,true);assert.equal(lossLetters(s).length,0);}}
 assert.deepEqual(s,batch);assert.equal(s.operativeState[116].hp,0);assert.equal(s.operativeState[116].alive,false);assert.equal(s.operativeState[107].morale,76,'only the existing six-point ordinary casualty loss applies');assert.equal(s.operativeState[107].carriedAmmo,ammo);assert.equal(s.operativeState[107].condition,condition);assert.equal(s.resources.treasury,cash);assert.equal(s.seed,seed);const letter=assertLossLetter(s),deathMinute=s.operativeState[116].deathMinute;
 s=order(saved(s).campaign,{type:'wait',hours:2});assert.equal(s.operativeState[116].deathMinute,deathMinute);assert.equal(s.operativeState[107].morale,76);assert.deepEqual(lossLetters(s),[letter]);assert.deepEqual(saved(s).campaign,s);
 t.diagnostic(JSON.stringify({tacticalOrders:actions.length,actionSeconds:p.battle.elapsedSeconds,returnedHp:returned.operativeState[116].hp,bleeding:returned.operativeState[116].bleeding,hourlyLoss:loss,hoursToDeath:hours,rounds:ammo,weaponCondition:condition,treasury:cash,morale:s.operativeState[107].morale,letter}));
});

test('an issued companion whose paid term expires remains a valid saved source until the actual return',()=>{
 let s=paidPair(defaultContentPackage(),'day');s=advanceTo(s,30*3600-30);s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle);assert.equal(issued(s).companionBonus,3);
 b=actBattle(b,{type:'rest',unitId:'107'});assert.equal(b.lastError,null);({campaign:s,battle:b}=checkpoint(s,b));assert.equal(s.contracts[116].departurePending,true);assert.equal(issued(s).companionId,116);assert.equal(issued(s).companionBonus,3);
 s=leave(s,b);assert.equal(s.operativeState[107].morale,80);assert.equal(s.recruited.includes(116),false);assert.equal(s.operativeState[116].alive,true);assert.deepEqual(saved(s).campaign,s);
});

test('receipt validation uses the original cohort, rejects malformed support, and keeps old pinned content neutral',()=>{
 const s=order(paidPair(),{type:'visitSector'}),b=enterSector(s.pendingBattle);assert.equal(issued(saved(s,b).campaign).companionBonus,3);
 for(const modify of [u=>u.companionBonus=0,u=>u.companionBonus=4,u=>u.companionBonus=null,u=>u.companionBonus='3',u=>u.companionId=107,u=>u.companionId=112,u=>u.companionId='116',u=>delete u.companionId,u=>delete u.companionBonus,u=>u.morale+=1,u=>{u.cohesionBonus=3;u.morale=u.personalMorale+6;}]){const invalid=structuredClone(s);modify(issued(invalid));assert.throws(()=>saved(invalid,b),/compañero|compañerismo/);}
 for(const modify of [r=>r.hp=14,r=>{r.hp=0;r.alive=false;},r=>r.captured=true,r=>r.asleep=true]){const changed=structuredClone(s);modify(changed.operativeState[116]);assert.doesNotThrow(()=>validateMorale(changed,rosterFor(changed)),'current state must not rewrite initial support');}
 for(const modify of [u=>u.hp=14,u=>u.energy=0,u=>u.captured=true,u=>u.asleep=true]){const invalid=structuredClone(s);modify(invalid.pendingBattle.squad.find(u=>u.id===116));assert.throws(()=>saved(invalid,b),/compañero/);}
 const old=defaultContentPackage();for(const c of old.characters)delete c.preferredCompanions;let neutral=paidPair(old);const neutralStart=structuredClone(neutral);neutral=order(neutral,{type:'visitSector'});noSupport(issued(neutral));neutral=saved(neutral,enterSector(neutral.pendingBattle)).campaign;noSupport(issued(neutral));assert.equal(issued(neutral).morale,80);assert.equal(issued(neutral).griefCompanionIds,undefined);
 let pair=checkpoint(neutral,enterSector(neutral.pendingBattle)),companion=pair.battle.units.find(u=>u.id==='116');const point={type:'firePoint',unitId:'107',x:companion.x,y:companion.y,aim:4},actions=[point,{type:'reload',unitId:'107'},point];for(const action of actions)pair=tactical(pair,action);
 assert.equal(pair.battle.units.find(u=>u.id==='116').hp,0);assert.equal(pair.battle.units.find(u=>u.id==='107').morale,62);assert.equal(pair.battle.units.find(u=>u.id==='107').companionGrief,undefined);assert.equal(pair.battle.log.includes(griefLine),false);assert.deepEqual(replayVisit(neutralStart,actions),pair);
 neutral=leave(pair.campaign,pair.battle);assert.equal(neutral.operativeState[107].morale,56,'an old pinned package retains only its existing casualty penalties');assert.equal(neutral.operativeState[116].alive,false);assert.equal(neutral.operativeState[107].carriedAmmo,8);assert.equal(neutral.operativeState[107].condition,98);assert.equal(neutral.operativeState[107].companionGrief,undefined);assert.equal(lossLetters(neutral).length,0);assert.deepEqual(saved(neutral).campaign,neutral);
});
