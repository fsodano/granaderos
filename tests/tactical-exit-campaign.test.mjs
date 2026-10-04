import {withStoredGear,withCarriedAmmo} from './commerce-gear-fixture.mjs';
import {withOwnedMount} from './custody-gear-fixture.mjs';
import {assertCustodyCare} from './custody-care-evidence.mjs';
import {ammunitionByType} from '../game/ammunition-types.js';
import {stockAndCarriedAmmo,stockAmmo} from './ammunition-balance.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign,rosterFor} from '../game/campaign.js';
import {createBattle,actBattle,endTurn} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {scriptedBattleReport} from './scripted-battle-report.mjs';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {prepareGarrison} from '../game/garrison.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const act=(b,a)=>{const n=actBattle(b,a);assert.equal(n.lastError,null,n.lastError);return n;};
const report=(s,b)=>({type:s.pendingBattle.exploration?'leaveSector':'battleResult',battleId:s.pendingBattle.id,outcome:b.status,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
const reject=(s,a)=>{const text=serializeCampaign(s),n=dispatchCampaign(s,a);assert.ok(n.lastError);assert.deepEqual({...n,lastError:null},JSON.parse(text));};
function prepared({attack=false,horses=false,corpseCartridges=0}={}){
 let s=withStoredGear(initialCampaign(),1801);s=order(s,{type:'equip',operativeId:3,itemId:1801,slot:'weapon'});s=order(s,{type:'travel',sector:'buenos_aires'});
 if(corpseCartridges)s=withCarriedAmmo(s,3,'ammoMusket',corpseCartridges);
 if(horses)for(const id of [3,4,10]){s=withOwnedMount(s,{name:`Caballo ${id}`}).state;s=order(s,{type:'horseAction',order:{type:'assign',horseId:s.horseState.horses.at(-1).id,operativeId:id}});}
 return order(s,attack?{type:'attack',sector:'san_nicolas'}:{type:'visitSector'});
}
// Prepared boundary fixture isolates campaign settlement. Crossing and all
// resulting energy/time/health changes still use the actual tactical reducer.
function field(s,patches={}){
 const r=s.pendingBattle,b=createBattle([...r.squad,...(r.garrison??[]),...(r.missionAllies??[])].map((u,i)=>({...u,x:2+i,y:15,...patches[u.id]})),{...r,width:20,height:16,tiles:Array.from({length:320},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',cover:0,blocked:false})),enemies:r.enemies.map((u,i)=>({...u,x:18,y:i,ap:0})),npcs:r.npcs.map((npc,i)=>({...npc,x:12-i,y:12})),props:[]});
 // This open boundary fixture does not open the arsenal. Keep the trusted
 // request metadata so settlement can verify that no piece was recovered.
 if(r.finiteArtilleryArsenal)b.finiteArtilleryArsenal=structuredClone(r.finiteArtilleryArsenal);
 for(const u of b.units){u.bandaged=Math.min(u.bandaged,u.maxHp-u.hp);if(u.side==='enemy')u.ap=0;}
 return b;
}
const flee=(b,id,destination)=>{b.units.find(u=>u.id===String(id)).routed=true;const n=endTurn(b);assert.equal(n.units.find(u=>u.id===String(id)).departure?.destination,destination);return n;};
const cross=(b,id,destination)=>act(b,{type:'exit',unitIds:[String(id)],exitId:b.exits.find(e=>e.destination===destination).id});

test('two real exits split one squad and retain a critical friendly resident and unmounted horses',()=>{
 let s=prepared({horses:true}),b=field(s,{3:{x:9,y:0,mounted:true},4:{x:19,y:7},10:{x:8,y:8,hp:10,bandaged:90,unconscious:true}});const horseIds=s.horseState.horses.map(h=>h.id),ownedRounds=stockAndCarriedAmmo(s);assert.equal(ownedRounds,20);
 b=cross(b,3,'retiro');assert.equal(b.status,'active');assert.equal(s.location,'buenos_aires');b=cross(b,4,'ensenada');assert.equal(b.status,'retreat');s=order(s,report(s,b));
 assert.equal(s.operativeState[3].location,'retiro');assert.equal(s.operativeState[4].location,'ensenada');assert.equal(s.operativeState[10].location,'buenos_aires');assert.equal(s.operativeState[10].captured,false);assert.equal(s.operativeState[10].hp,10);assert.deepEqual(s.squad,[10]);assert.equal(s.location,'buenos_aires');assert.equal(s.squads.length,3);assert.equal(stockAndCarriedAmmo(s),ownedRounds);
 assert.equal(s.horseState.horses.find(h=>h.id===horseIds[0]).location,'retiro');assert.equal(s.horseState.horses.find(h=>h.id===horseIds[1]).location,'buenos_aires');assert.equal(s.horseState.horses.find(h=>h.id===horseIds[1]).assignedTo,null);assert.equal(s.horseState.horses.find(h=>h.id===horseIds[2]).location,'buenos_aires');assert.equal(s.horseState.horses.find(h=>h.id===horseIds[2]).assignedTo,10);assert.equal(s.secondOfHour,b.elapsedSeconds);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});

test('a hostile retreat keeps unconscious survivors and exact ammunition in captive custody until recapture',()=>{
 let s=prepared({attack:true,horses:true}),b=field(s,{4:{hp:10,bandaged:90,unconscious:true,condition:31,medkits:0},10:{hp:0,bleeding:0,bandaged:0,unconscious:false}});const captiveHorse=s.horseState.horses.find(h=>h.assignedTo===4).id,captive=b.units.find(u=>u.id==='4'),captiveAmmo={loaded:captive.loaded,ammo:captive.ammo,preserveLoading:true};assert.deepEqual(captiveAmmo,{loaded:1,ammo:9,preserveLoading:true});
 b=cross(b,3,'buenos_aires');assert.equal(b.status,'retreat');const action=report(s,b),stock=stockAmmo(s);s=order(s,action);assert.equal(s.location,'buenos_aires');assert.deepEqual(s.squad,[3]);assert.equal(s.operativeState[4].captured,true);assert.equal(s.operativeState[4].condition,31);assert.equal(s.operativeState[4].medkits,0);assert.deepEqual(s.operativeState[4].capturedAmmunition,captiveAmmo);assert.equal(stockAndCarriedAmmo(s),stock);assert.equal(s.operativeState[10].alive,false);assert.equal(s.horseState.horses.find(h=>h.id===captiveHorse).custody.kind,'captured');reject(s,action);reject(s,{type:'horseAction',order:{type:'assign',horseId:captiveHorse,operativeId:3}});s=restoreCampaign(serializeCampaign(s));
 s=order(s,{type:'attack',sector:'san_nicolas'});const before=stockAmmo(s);s=order(s,scriptedBattleReport(s));assert.equal(s.operativeState[4].captured,false);assert.equal(s.operativeState[4].hp,10);assert.equal(s.operativeState[4].condition,31);assert.equal(s.operativeState[4].medkits,0);assert.deepEqual(s.operativeState[4].capturedAmmunition,{loaded:0,ammo:0});assert.equal(stockAndCarriedAmmo(s),before+captiveAmmo.loaded+captiveAmmo.ammo);assert.equal(s.horseState.horses.find(h=>h.id===captiveHorse).custody,null);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});

test('exit reports reject active labels and forged route topology without changing time or supplies',()=>{
 const s=prepared({attack:true}),b=field(s);reject(s,{...report(s,b),outcome:'retreat'});
 const escaped=cross(field(s,{4:{hp:10,bandaged:90},10:{hp:10,bandaged:90}}),3,'buenos_aires');
 for(const alter of [a=>a.sectorState.units.find(u=>u.id==='3').departure.destination='humahuaca',a=>a.sectorState.units.find(u=>u.id==='3').departure.elapsedSeconds=99999,a=>a.sectorState.exits[0].entryAnchor.x=99,a=>a.survivors.pop(),a=>a.sectorState.status='active']){const a=structuredClone(report(s,escaped));alter(a);reject(s,a);}
 const forged=structuredClone(s);forged.pendingBattle.exits[0].destination='humahuaca';const a=report(forged,structuredClone(escaped));a.sectorState.exits=structuredClone(forged.pendingBattle.exits);reject(forged,a);
});

test('a death after a paid departure leaves one finite body at the destination through save and reentry',()=>{
 let s=prepared({corpseCartridges:10}),b=field(s,{3:{x:9,y:0,hp:16,bleeding:3,bandaged:0,condition:27}});const initialOwnedRounds=stockAndCarriedAmmo(s);assert.equal(initialOwnedRounds,30);b=cross(b,3,'retiro');assert.ok(b.units.find(u=>u.id==='3').departure);b=endTurn(b);assert.equal(b.units.find(u=>u.id==='3').hp,0);s=order(s,report(s,b));assert.equal(s.sectorRemains.retiro.length,1);assert.equal(s.operativeState[3].alive,false);assert.equal(s.sectorRemains.retiro[0].unit.condition,27);
 const bad=structuredClone(s);bad.sectorRemains.retiro[0].unit.ammo=-1;assert.throws(()=>restoreCampaign(serializeCampaign(bad)));s=restoreCampaign(serializeCampaign(s));s=order(s,{type:'travel',sector:'retiro'});s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);const body=b.units.find(u=>u.id==='3');assert.equal(body.hp,0);assert.equal(body.condition,27);assert.equal(body.y,b.height-1);const rounds=body.ammo;assert.equal(rounds,10);assert.equal(stockAndCarriedAmmo(s)+rounds,initialOwnedRounds);b=act(b,{type:'loot',unitId:'4',targetId:'3',item:'inventory:ammo:musket_75',count:rounds});assert.equal(b.units.find(u=>u.id==='3').ammo,0);s=order(s,report(s,b));assert.equal(stockAndCarriedAmmo(s),initialOwnedRounds);assert.deepEqual(s.sectorRemains.retiro,[]);s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(b.units.filter(u=>u.id==='3').length,1);assert.equal(b.units.find(u=>u.id==='3').condition,27);
});

test('a partial exit saves without relocating the pending squad or inventing a legacy departure',()=>{
 let s=prepared(),b=field(s,{3:{x:9,y:0}});b=cross(b,3,'retiro');s=order(s,{type:'syncTacticalTime',battleId:s.pendingBattle.id,elapsedSeconds:b.elapsedSeconds});b.syncedSeconds=b.elapsedSeconds;const pair=decodeSave(encodeSave(s,b));assert.equal(pair.campaign.location,'buenos_aires');assert.equal(pair.battle.units.find(u=>u.id==='3').departure.destination,'retiro');assert.equal(pair.campaign.pendingBattle.squad.length,3);
 const legacy=JSON.parse(encodeSave(prepared(),field(prepared())));delete legacy.campaign.pendingBattle.exits;delete legacy.campaign.pendingBattle.exitRulesVersion;delete legacy.battle.exits;delete legacy.battle.exitRulesVersion;delete legacy.battle.battleId;const old=decodeSave(JSON.stringify(legacy));assert.ok(old.battle.exits.length);assert.ok(old.battle.units.every(u=>!u.departure));reject(old.campaign,{...report(old.campaign,old.battle),outcome:'retreat',type:'battleResult'});
 assert.equal(old.campaign.resources.treasury,legacy.campaign.resources.treasury);assert.deepEqual(old.campaign.ammunitionShops,legacy.campaign.ammunitionShops);assert.deepEqual(old.campaign.pendingBattle.issuedAmmunition,legacy.campaign.pendingBattle.issuedAmmunition);assert.deepEqual(old.campaign.pendingBattle.fieldAmmunition,legacy.campaign.pendingBattle.fieldAmmunition);
 assert.deepEqual(decodeSave(encodeSave(old.campaign,old.battle)),old);
 const occupied=structuredClone(legacy);occupied.campaign.sectors.retiro.owner='royalist';const limited=decodeSave(JSON.stringify(occupied));assert.ok(!limited.battle.exits.some(exit=>exit.destination==='retiro'));assert.ok(limited.battle.exits.some(exit=>exit.destination==='ensenada'));
 for(const target of ['battle','request'])for(const key of ['exits','exitRulesVersion']){const corrupt=JSON.parse(encodeSave(pair.campaign,pair.battle));delete (target==='battle'?corrupt.battle:corrupt.campaign.pendingBattle)[key];assert.throws(()=>decodeSave(JSON.stringify(corrupt)),/salida|rutas/);}
});

test('split overflow stays at actual destinations as reserves and does not move remote squads',()=>{
 let s=prepared();for(let i=2;i<=8;i++)s.squads.push({id:`squad-${i}`,name:`Reserva ${i}`,members:[],location:'ensenada'});const remote=structuredClone(s.squads.slice(1));let b=field(s,{3:{x:9,y:0},4:{x:19,y:7},10:{x:8,y:8,hp:10,bandaged:90}});b=cross(b,3,'retiro');b=cross(b,4,'ensenada');s=order(s,report(s,b));assert.equal(s.squads.length,8);assert.deepEqual(s.squads.slice(1),remote);assert.ok(!s.squads.some(q=>q.members.includes(3)||q.members.includes(4)));assert.equal(s.operativeState[3].location,'retiro');assert.equal(s.operativeState[4].location,'ensenada');assert.deepEqual(s.squad,[10]);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});

test('actual militia departure moves one finite soldier and keeps destination overflow as reserves',()=>{
 let s=initialCampaign();s.sectors.retiro.militia=[60,0,0];prepareGarrison(s,'retiro');s=order(s,{type:'travel',sector:'buenos_aires'});s.sectors.buenos_aires.militia=[3,0,0];s=order(s,{type:'visitSector'});const id=s.pendingBattle.garrison[0].id;let b=field(s,{3:{x:8,y:0},[id]:{x:9,y:0}});const rounds=b.units.find(u=>u.id===String(id)).ammo+b.units.find(u=>u.id===String(id)).loaded;b=flee(b,id,'retiro');b=cross(b,3,'retiro');s=order(s,report(s,b));assert.equal(s.sectors.buenos_aires.militia[0],2);assert.equal(s.sectors.retiro.militia[0],61);assert.equal(s.garrisons.retiro.length,61);assert.equal(s.garrisons.retiro.find(u=>u.id===id).ammo+s.garrisons.retiro.find(u=>u.id===id).loaded,rounds);assert.ok(!s.garrisons.buenos_aires.some(u=>u.id===id));s=restoreCampaign(serializeCampaign(s));
 const deployed=prepareGarrison(s,'retiro');assert.equal(deployed.length,60);assert.equal(s.garrisons.retiro.length,61);assert.equal(s.garrisons.retiro.find(u=>u.id===id).ammo+s.garrisons.retiro.find(u=>u.id===id).loaded,rounds);
});

test('a remote defense partitions its actual participants without moving the selected squad',()=>{
 let s=order(initialCampaign(),{type:'recruitCivic',id:100,term:'week'});s=order(s,{type:'createSquad',ids:[100],name:'Reserva remota'});s=order(s,{type:'travel',sector:'ensenada'});const selected=structuredClone(s.squads.find(q=>q.id===s.activeSquadId));launchEnemyGroup(s,'coast','retiro',{immediate:true});s=order(s,{type:'wait',hours:1});s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'tactical'});let b=field(s,{4:{hp:10},10:{hp:10}});b=cross(b,3,'buenos_aires');s=order(s,report(s,b));assert.deepEqual(s.squads.find(q=>q.id===s.activeSquadId),selected);assert.equal(s.location,'ensenada');assert.equal(s.operativeState[3].location,'buenos_aires');assert.equal(s.operativeState[4].captured,true);assert.equal(s.operativeState[10].captured,true);assert.equal(s.enemyGroups[0].status,'stationed');assert.equal(s.sectors.retiro.owner,'patriot');assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});

test('bounded automatic withdrawal keeps a synchronized pending battle when no exit can be reached',()=>{
 // The sealed western room has no exit. The invaders enter the separate
 // eastern yard through its open southern edge; no unit spawns through a wall.
 let s=initialCampaign();const tiles=Array.from({length:320},(_,i)=>{const x=i%20,y=Math.floor(i/20),wall=x===0||x===19||y===0||(y===15&&x<9)||x===8;return{x,y,type:wall?'wall':'grass',blocked:wall,cover:wall?100:0};});s.sectorStates.retiro=createBattle([],{id:'old-enclosure',sector:'retiro',errandDefinitions:s.errandDefinitions,width:20,height:16,tiles,enemies:[]});launchEnemyGroup(s,'coast','retiro',{immediate:true});s=order(s,{type:'wait',hours:1});s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'auto'});assert.ok(s.pendingBattle);const b=s.pendingBattle.resumeSnapshot;assert.ok(b);assert.equal(b.status,'active');assert.equal(s.enemyGroups[0].status,'engaged');assert.equal(b.battleId,s.pendingBattle.id);assert.equal(b.elapsedSeconds,s.pendingBattle.syncedSeconds);assert.equal(b.savedHour,s.hour);assert.equal(b.savedSecond,s.secondOfHour);assert.ok(b.units.filter(u=>u.side==='player').every(u=>!u.departure));assert.doesNotThrow(()=>decodeSave(encodeSave(s,b)));
 const sameClock=order(s,{type:'syncTacticalTime',battleId:s.pendingBattle.id,elapsedSeconds:b.elapsedSeconds});assert.equal(sameClock.pendingBattle.resumeSnapshot,undefined,'The handoff cache is also discarded when AP changes within the same clock interval.');assert.doesNotThrow(()=>decodeSave(encodeSave(sameClock,b)));
 const manual=endTurn(b);assert.equal(manual.lastError,null);s=order(s,{type:'syncTacticalTime',battleId:s.pendingBattle.id,elapsedSeconds:manual.elapsedSeconds});manual.syncedSeconds=manual.elapsedSeconds;manual.savedHour=s.hour;manual.savedSecond=s.secondOfHour;assert.equal(s.pendingBattle.resumeSnapshot,undefined);assert.doesNotThrow(()=>decodeSave(encodeSave(s,manual)));
});


test('later visits recover prior hired-body ammunition once without reusing the original issue credit',()=>{
 let s=order(initialCampaign(),{type:'visitSector'}),b=field(s,{4:{hp:0,bandaged:0,bleeding:0,unconscious:false}});const rounds=b.units.find(u=>u.id==='4').ammo,initial=stockAmmo(s);s=order(s,report(s,b));assert.equal(stockAndCarriedAmmo(s),initial+10);s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);const before=stockAmmo(s);b=act(b,{type:'loot',unitId:'3',targetId:'4',item:'inventory:ammo:pistol_69',count:rounds});assert.equal(b.units.find(u=>u.id==='4').ammo,0);s=order(s,report(s,b));assert.equal(stockAndCarriedAmmo(s),before+10+rounds);s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(b.units.find(u=>u.id==='4').ammo,0);const final=stockAmmo(s);s=order(s,report(s,b));assert.equal(stockAndCarriedAmmo(s),final+10+rounds);assert.equal(b.units.find(u=>u.id==='4').loaded,1);
});

test('a militia soldier who dies after departure leaves a destination body without adding living militia',()=>{
 let s=order(initialCampaign(),{type:'travel',sector:'buenos_aires'});s.sectors.buenos_aires.militia=[1,0,0];s=order(s,{type:'visitSector'});const id=s.pendingBattle.garrison[0].id;let b=field(s,{[id]:{x:9,y:0,hp:16,bleeding:3,bandaged:0}});b=flee(b,id,'retiro');b=endTurn(b);assert.equal(b.units.find(u=>u.id===String(id)).hp,0);s=order(s,report(s,b));assert.equal(s.sectors.buenos_aires.militia[0],0);assert.equal(s.sectors.retiro.militia[0],0);assert.equal(s.sectorRemains.retiro[0].unitId,String(id));assert.equal(s.sectorRemains.retiro[0].unit.militia,true);s=restoreCampaign(serializeCampaign(s));s=order(s,{type:'travel',sector:'retiro'});s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(b.units.find(u=>u.id===String(id)).hp,0);s=order(s,report(s,b));assert.equal(s.sectors.retiro.militia[0],0);assert.deepEqual(s.sectorRemains.retiro,[]);
});

test('direct militia supply orders are rejected and a living garrison retains finite rounds across visits',()=>{
 let s=initialCampaign();s.sectors.retiro.militia=[1,0,0];s=order(s,{type:'visitSector'});const id=s.pendingBattle.garrison[0].id;let b=field(s,{3:{x:2,y:2},4:{x:4,y:2},10:{x:6,y:2},[id]:{x:3,y:2}});assert.equal(stockAndCarriedAmmo(s),20);const rejected=actBattle(b,{type:'transfer',unitId:String(id),targetId:'3',item:'inventory:ammo:musket_75',count:5});assert.match(rejected.lastError,/milicia actúa/);assert.deepEqual(rejected.units,b.units);s=order(s,report(s,b));assert.equal(stockAndCarriedAmmo(s),20);assert.equal(s.garrisons.retiro[0].loaded+s.garrisons.retiro[0].ammo,6);s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);const stock=stockAmmo(s);s=order(s,report(s,b));assert.equal(stockAndCarriedAmmo(s),stock+20);assert.equal(s.garrisons.retiro[0].loaded+s.garrisons.retiro[0].ammo,6);
});


test('equipping a loaded enemy gun preserves its chamber round when its new owner received no cartridges',()=>{
 let s=initialCampaign();s.operativeState[3].residentSector='retiro';s.sectorStates.retiro=createBattle(rosterFor(s).filter(u=>s.squad.includes(u.id)).map((u,i)=>({...u,...s.operativeState[u.id],x:2+i*2,y:2})),{id:'old-field',sector:'retiro',errandDefinitions:s.errandDefinitions,width:20,height:16,tiles:Array.from({length:320},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',cover:0,blocked:false})),enemies:[{id:'old-body',x:3,y:2,hp:0,weapon:1801,loaded:1,ammo:0}]});s.sectorStates.retiro.sectorCleared=true;s=order(s,{type:'visitSector'});assert.equal(s.pendingBattle.squad.find(u=>u.id===3).ammo,0);let b=enterSector(s.pendingBattle,s.sectorStates.retiro);b=act(b,{type:'loot',unitId:'3',targetId:'old-body',item:'weapon',count:1});const inventoryKey=Object.entries(b.units.find(u=>u.id==='3').inventory).find(([,r])=>r.weapon===1801)[0];b=act(b,{type:'equipLoot',unitId:'3',inventoryKey});assert.equal(b.units.find(u=>u.id==='3').loaded,1);assert.equal(b.units.find(u=>u.id==='old-body').loaded,0);const before=stockAmmo(s);s=order(s,report(s,b));assert.equal(stockAndCarriedAmmo(s),before+21);const cash=s.resources.treasury,ownedStores=structuredClone(s.ammunitionStores),ownedRounds=stockAndCarriedAmmo(s);s=restoreCampaign(serializeCampaign(s));s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);s=order(s,report(s,b));assert.equal(stockAndCarriedAmmo(s),ownedRounds);assert.equal(b.units.find(u=>u.id==='3').loaded,1);assert.equal(s.resources.treasury,cash);assert.deepEqual(s.ammunitionStores,ownedStores);
});

test('corpse-inclusive return ledgers restore above the live-unit limit while preserving exact membership',()=>{
 const s=initialCampaign(),b=createBattle(Array.from({length:205},(_,i)=>({id:20000+i,name:`Miliciano caído ${i}`,hp:0,maxHp:60,militia:true,militiaRank:0,weapon:1804,loaded:1,ammo:i%6,condition:50+i%30,x:i%20,y:Math.floor(i/20)})),{id:'long-defense-history',sector:'retiro',errandDefinitions:s.errandDefinitions,width:20,height:16,enemies:[]});
 b.returnLedger={battleId:b.battleId,entries:b.units.map(u=>({unitId:u.id,kind:'dead',sector:'retiro'})),creditedCartridges:0};s.sectorStates.retiro=b;
 const restored=restoreCampaign(serializeCampaign(s));assert.equal(restored.sectorStates.retiro.returnLedger.entries.length,205);assert.deepEqual(restored.sectorStates.retiro.units,b.units);assert.deepEqual(decodeSave(encodeSave(s)).campaign.sectorStates.retiro,b);
 for(const alter of [ledger=>ledger.entries[0].unitId='missing-body',ledger=>ledger.entries[0].unitId=ledger.entries[1].unitId,ledger=>ledger.entries[0].kind='resident',ledger=>ledger.entries[0].sector='salta']){const bad=structuredClone(s);alter(bad.sectorStates.retiro.returnLedger);assert.throws(()=>restoreCampaign(serializeCampaign(bad)));}
});

// Scripted victory isolates campaign settlement; capture and return use real
// movement/encounter orders. This does not establish combat balance.
test('returning defenders free coastal captives without requiring a change of sector owner',()=>{
 let s=order(initialCampaign(),{type:'recruitCivic',id:100,term:'week'});
 s=order(s,{type:'createSquad',ids:[100],name:'Rescate'});
 s=order(s,{type:'travel',sector:'buenos_aires',queue:true});
 s=order(s,{type:'wait',hours:2});
 launchEnemyGroup(s,'coast','retiro',{immediate:true});
 s=order(s,{type:'wait',hours:1});
 s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'tactical'});
 let b=field(s,{4:{hp:10,bandaged:74},10:{hp:10,bandaged:86}});
 b=cross(b,3,'buenos_aires');s=order(s,report(s,b));
 assert.equal(s.sectors.retiro.owner,'patriot');assert.equal(s.blockade,true);
 const custodyStart=structuredClone(s),held=structuredClone(s.operativeState[4]);assert.equal(held.captured,true);
 s=restoreCampaign(serializeCampaign(s));
 s=order(s,{type:'cancelTravel',choice:'return'});
 for(let i=0;i<48&&!s.pendingEncounter;i++)s=order(s,{type:'wait',hours:1});
 assert.ok(s.pendingEncounter,JSON.stringify(s.squads));
 s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'tactical'});
 assert.equal(s.pendingBattle.wasRoyalist,false);
 for(const id of [4,10])assertCustodyCare(custodyStart,s,id);
 const caredHp=s.operativeState[4].hp;
 const contested=structuredClone(s);launchEnemyGroup(contested,'coast','retiro',{immediate:true});
 const uncleared=order(contested,scriptedBattleReport(contested));
 assert.equal(uncleared.blockade,true,'the unresolved coastal force must retain the blockade');
 for(const id of [4,10])assert.equal(uncleared.operativeState[id].captured,true,'another local enemy group must prevent release');
 assert.deepEqual(restoreCampaign(serializeCampaign(uncleared)),uncleared);
 const victory=scriptedBattleReport(s);
 s=order(s,victory);
 assert.equal(s.sectors.retiro.owner,'patriot');assert.equal(s.blockade,false);
 for(const id of [4,10]){assert.equal(s.operativeState[id].captured,false);assert.ok(s.recruited.includes(id));}
 const freed=s.operativeState[4];assert.equal(freed.hp,caredHp);assert.equal(freed.condition,held.condition);
 assert.equal(freed.carriedLoaded,held.capturedAmmunition.loaded);assert.equal(freed.carriedAmmo,held.capturedAmmunition.ammo+held.capturedAmmunition.loaded);
 assert.deepEqual(ammunitionByType(freed),ammunitionByType(held));
 assert.equal(freed.assignment,'patient');assert.equal(freed.location,'retiro');
 assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);assert.doesNotThrow(()=>decodeSave(encodeSave(s)));
 reject(s,victory);
});
