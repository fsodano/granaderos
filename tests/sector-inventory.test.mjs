import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign as dispatch,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {createBattle,actBattle} from '../game/tactical.js';
import {discoverInventory} from '../game/inventory-discovery.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {playerKnownCampaign} from '../game/player-known-state.js';
import {planReturnAmmunition} from '../game/ammunition.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
const order=(s,a)=>{const n=dispatch(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const act=(s,a)=>{const n=actBattle(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const flat=()=>Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',cover:0,blocked:false}));
function entered(){let s=initialCampaign(45);s.hour=12;s=order(s,{type:'visitSector'});const r=s.pendingBattle,b=createBattle(r.squad.map((u,i)=>({...u,x:2,y:2+i})),{...r,width:12,height:10,tiles:flat(),enemies:[],props:[],npcs:[]});return {s,b};}
function leave(s,b){return order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});}
function prepared(item='medkits',count=1){let {s,b}=entered();b=act(b,{type:'drop',unitId:'4',item,count});return leave(s,b);}
const model=(s,id=4)=>sectorInventoryModel(s,'retiro',rosterFor(s),id);
const take=(s,row,count=1,id=4)=>order(s,{type:'sectorInventory',sector:'retiro',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});
const reject=(s,action)=>{const next=dispatch(s,action);assert.ok(next.lastError);assert.deepEqual({...next,lastError:null},{...s,lastError:null});};

test('a discovered tactical drop is collected from the map once, with exact quantities and no free recovery',()=>{
 let s=prepared('medkits',2),m=model(s),r=m.entries[0];assert.equal(r.reachable,true);assert.equal(r.count,2);
 const before={hour:s.hour,second:s.secondOfHour,seed:s.seed,hp:s.operativeState[4].hp,energy:s.operativeState[4].energy,treasury:s.resources.treasury};
 s=take(s,r);assert.equal(s.operativeState[4].medkits,1);assert.equal(model(s).entries[0].count,1);
 assert.deepEqual({hour:s.hour,second:s.secondOfHour,seed:s.seed,hp:s.operativeState[4].hp,energy:s.operativeState[4].energy,treasury:s.resources.treasury},before);
 reject(s,{type:'sectorInventory',sector:'retiro',operativeId:4,direction:'take',sourceKey:r.key,expected:r.expected,count:1});
 s=take(s,model(s).entries[0]);assert.deepEqual(model(s).entries,[]);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
 s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(b.groundItems[0].count,0);assert.equal(b.units.find(u=>u.id==='4').medkits,2);assert.deepEqual(decodeSave(encodeSave(s,b)).battle,b);
});

test('map drops and pickups preserve a real held weapon and prevent a duplicate on reentry',()=>{
 let s=prepared();const weapon=rosterFor(s).find(u=>u.id===4).weapon;s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:4,direction:'drop',item:'primary',count:1});
 assert.equal(s.operativeState[4].weaponDropped,true);const row=model(s,10).entries.find(row=>row.loaded===0);assert.ok(row);s=take(s,row,1,10);
 assert.ok(Object.values(s.operativeState[10].inventory).some(item=>item.weapon===weapon));
 s=restoreCampaign(serializeCampaign(s));s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle,s.sectorStates.retiro);
 assert.equal(b.units.find(u=>u.id==='4').weaponDropped,true);assert.equal(b.groundItems.filter(g=>g.weapon===weapon&&g.count>0).length,0);
});

test('loose map cartridges stay with their selected carrier and enter a visit exactly once',()=>{
 let s=prepared('ammo',5);assert.equal(s.resources.cartridges,295);s=take(s,model(s).entries[0],5,10);assert.equal(s.resources.cartridges,295);assert.equal(s.operativeState[10].carriedAmmo,5);
 s=restoreCampaign(serializeCampaign(s));s=order(s,{type:'visitSector'});assert.equal(s.operativeState[10].carriedAmmo,0);assert.equal(s.resources.cartridges,280);assert.equal(s.pendingBattle.issuedCartridges,20);
 const b=enterSector(s.pendingBattle,s.sectorStates.retiro);s=leave(s,b);assert.equal(s.resources.cartridges,300);assert.equal(model(s).entries.length,0);
});

test('a carrier without a firearm retains picked cartridges through deployment and campaign return',()=>{
 let s=prepared('ammo',5);s=take(s,model(s).entries[0],5,3);s=order(s,{type:'visitSector'});assert.equal(s.pendingBattle.squad.find(u=>u.id===3).ammo,5);assert.equal(s.pendingBattle.issuedCartridges,25);
 const b=enterSector(s.pendingBattle,s.sectorStates.retiro);s=leave(s,b);assert.equal(s.resources.cartridges,300);
});

test('attack and forced defense each account for personal cartridges without charging shared stock twice',()=>{
 for(const defense of [false,true]){
  let s=prepared('ammo',5);s=take(s,model(s).entries[0],5,10);const before=s.resources.cartridges;
  if(defense){launchEnemyGroup(s,'coast','retiro',{immediate:true});s=order(s,{type:'wait',hours:1});s=order(s,{type:'respondToEncounter',groupId:s.pendingEncounter.groupId,choice:'tactical'});}
  else {s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});}
  assert.equal(s.resources.cartridges,before-15);assert.equal(s.pendingBattle.issuedCartridges,20);assert.equal(s.operativeState[10].carriedAmmo,0);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
 }
});

test('discovery retains known objects while hidden ground, distant bodies and closed containers remain private',()=>{
 const b=createBattle([{id:'p',x:1,y:1}],{width:12,height:10,tiles:flat(),exploration:true,enemies:[{id:'body',x:9,y:1,hp:0}]});
 b.groundItems=[{id:'seen',x:2,y:1,type:'item',item:'ammo',count:2,weight:.04},{id:'hidden',x:0,y:9,type:'item',item:'medkits',count:3,weight:.2}];
 b.props=[{id:'closed',type:'chest',x:2,y:2,open:false,contents:[{item:'ammo',count:3,weight:.04}]}];discoverInventory(b);
 assert.equal(b.groundItems[0].knownToPlayer,true);assert.equal(b.groundItems[1].knownToPlayer,undefined);assert.equal(b.units[1].knownToPlayer,undefined);assert.equal(b.props[0].knownToPlayer,undefined);
 b.units[0].x=8;discoverInventory(b);assert.equal(b.units[1].knownToPlayer,true);assert.equal(b.groundItems[0].knownToPlayer,true);
 for(const value of [b.groundItems[0],b.units[1],b.props[0]]){value.knownToPlayer='yes';assert.throws(()=>validateBattleSnapshot(b));value.knownToPlayer=true;}
});

test('known supplies behind a closed wall are visible but cannot be remotely collected',()=>{
 const s=prepared(),b=s.sectorStates.retiro;for(const t of b.tiles.filter(t=>t.x===4)){t.blocked=true;t.blocksSight=true;t.type='wall';}b.groundItems[0].x=8;
 const row=model(s).entries[0];assert.equal(row.reachable,false);reject(s,{type:'sectorInventory',sector:'retiro',operativeId:4,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
});

test('sleep, capture, absence, occupation, pending battle and capacity reject without moving any source',()=>{
 const base=prepared();for(const change of [s=>s.operativeState[4].asleep=true,s=>s.operativeState[4].captured=true,s=>{s.squads[0].location='ensenada';},s=>s.sectors.retiro.owner='royalist',s=>s.operativeState[4].inventory={bulky:{count:7,weight:4}}]){
  const s=structuredClone(base);change(s);const row=model(base).entries[0];reject(s,{type:'sectorInventory',sector:'retiro',operativeId:4,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
 }
 const pending=order(base,{type:'visitSector'});reject(pending,{type:'sectorInventory',sector:'retiro',operativeId:4,direction:'drop',item:'medkits',count:1});
 for(const count of [-1,1.5,Infinity]){const s=structuredClone(base);s.operativeState[4].carriedAmmo=count;assert.throws(()=>restoreCampaign(serializeCampaign(s)));}
});

test('loaded fitted weapons retain both identities, wear and ignition state through map pickup and reentry',()=>{
 let {s,b}=entered();const u=b.units.find(u=>u.id==='10');
 Object.assign(u,{weapon:1800,weaponInstanceId:'map-musket',condition:62,loaded:1,jammed:true,weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'map-socket',condition:47}}});
 b=act(b,{type:'drop',unitId:'10',item:'primary',count:1});const original=structuredClone(b.groundItems[0]);s=leave(s,b);const row=model(s).entries[0];
 assert.equal(row.loaded,1);assert.equal(row.condition,62);assert.equal(row.jammed,true);s=take(s,row,1,4);
 const stored=Object.values(s.operativeState[4].inventory).find(item=>item.instanceId==='map-musket');
 for(const key of ['weapon','loaded','condition','jammed','instanceId','fittings'])assert.deepEqual(stored[key],original[key]);assert.equal(stored.knownToPlayer,undefined);
 s=restoreCampaign(serializeCampaign(s));s=order(s,{type:'visitSector'});const next=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(next.groundItems[0].count,0);assert.ok(Object.values(next.units.find(u=>u.id==='4').inventory).some(item=>item.instanceId==='map-musket'));
 assert.deepEqual(decodeSave(encodeSave(s,next)).battle,next);
});

test('discovered open containers allow partial pickup, reject stale rows, and keep hidden or trapped contents private',()=>{
 let {s,b}=entered();b.props=[{id:'cache',type:'chest',x:3,y:2,open:true,locked:false,contents:[{item:'medkits',count:2,weight:.2},{item:'flints',count:1,weight:.05}]},
 {id:'closed',type:'chest',x:4,y:2,open:false,contents:[{item:'rations',count:3,weight:.5}]},
 {id:'trapped',type:'chest',x:3,y:4,open:true,knownToPlayer:true,trap:{type:'alarm',difficulty:30,armed:true,discoveredBy:[]},contents:[{item:'ammo',count:15,weight:.04}]}];
 discoverInventory(b);s=leave(s,b);assert.equal(model(s).entries.length,2);
 const original=model(s).entries[0];s=take(s,original);assert.equal(s.sectorStates.retiro.props[0].contents[0].count,1);s=take(s,model(s).entries[0]);
 reject(s,{type:'sectorInventory',sector:'retiro',operativeId:4,direction:'take',sourceKey:original.key,expected:original.expected,count:1});
 assert.equal(model(s).entries[0].label,'Piedras de chispa');s=restoreCampaign(serializeCampaign(s));assert.equal(s.sectorStates.retiro.props[1].contents[0].count,3);
});

test('a searched corpse gives finite supplies and retains the depleted body after reentry',()=>{
 let {s,b}=entered();const body=createBattle([],{width:12,height:10,tiles:flat(),enemies:[{id:'searched-body',x:3,y:2,hp:0,ammo:7}]}).units[0];b.units.push(body);s.pendingBattle.enemies=[structuredClone(body)];discoverInventory(b);s=leave(s,b);
 const row=model(s).entries.find(row=>row.kind==='body'&&row.label==='Cartuchos');assert.ok(row);s=take(s,row,3);assert.equal(s.sectorStates.retiro.units.find(u=>u.id===body.id).ammo,4);assert.equal(s.operativeState[4].carriedAmmo,3);
 s=order(restoreCampaign(serializeCampaign(s)),{type:'visitSector'});const next=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(next.units.find(u=>u.id===body.id).ammo,4);assert.equal(next.units.find(u=>u.id==='4').ammo+next.units.find(u=>u.id==='4').loaded,10);
});

test('personal cartridges can be dropped on the map and recovered tactically without disappearing on return',()=>{
 let s=prepared('ammo',5);s=take(s,model(s).entries[0],5,4);s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:4,direction:'drop',item:'ammo',count:3});
 assert.equal(s.operativeState[4].carriedAmmo,2);s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle,s.sectorStates.retiro);const ground=b.groundItems.find(g=>g.count===3);
 b=act(b,{type:'loot',unitId:'4',groundId:ground.id,count:3});s=leave(s,b);assert.equal(s.resources.cartridges,300);
});


test('strategic public state reports only discovered equipment and personal cartridges',()=>{
 const s=prepared('ammo',5),b=s.sectorStates.retiro;b.groundItems.push({id:'secret',type:'item',item:'inventory:hidden-plan',count:1,weight:0,x:11,y:9});
 const before=structuredClone(s),known=playerKnownCampaign(s),sector=known.sectors.find(row=>row.id==='retiro');
 assert.equal(sector.equipment.length,1);assert.equal(sector.equipment[0].count,5);assert.equal(sector.equipment[0].label,'Cartuchos');assert.doesNotMatch(JSON.stringify(known),/hidden-plan|secret|knownToPlayer/);assert.deepEqual(s,before);
 const next=take(s,model(s).entries[0],2);assert.equal(playerKnownCampaign(next).operatives.find(u=>u.id===4).carriedAmmo,2);
});


test('a previously dropped compact firearm keeps its catalog weight and finite load',()=>{
 let {s,b}=entered();b.droppedWeapons.push({x:3,y:2,weapon:1805,loaded:1,condition:59,jammed:true,taken:false});discoverInventory(b);s=leave(s,b);
 const row=model(s).entries.find(row=>row.kind==='drop');s=take(s,row);const stored=Object.values(s.operativeState[4].inventory).find(item=>item.weapon===1805);
 assert.equal(stored.weight,1.3);assert.equal(stored.loaded,1);assert.equal(stored.condition,59);assert.equal(stored.jammed,true);assert.equal(stored.knownToPlayer,undefined);assert.equal(s.sectorStates.retiro.droppedWeapons[0].taken,true);
 s=restoreCampaign(serializeCampaign(s));assert.equal(model(s).entries.length,0);
});


test('a loaded gun carried into a visit can be equipped and returned without losing its charge',()=>{
 for(const id of [4,10]){
  let {s,b}=entered();const u=b.units.find(u=>u.id===String(id)),loaded=u.loaded;assert.ok(loaded>0);
  b=act(b,{type:'drop',unitId:String(id),item:'primary'});s=leave(s,b);assert.equal(s.resources.cartridges,300-loaded);
  s=take(s,model(s,id).entries.find(row=>row.loaded===loaded),1,id);s=order(restoreCampaign(serializeCampaign(s)),{type:'visitSector'});
  b=enterSector(s.pendingBattle,s.sectorStates.retiro);const key=Object.keys(b.units.find(u=>u.id===String(id)).inventory).find(key=>key.startsWith('weapon:'));
  b=act(b,{type:'equipLoot',unitId:String(id),inventoryKey:key,slot:'primary'});assert.equal(b.units.find(u=>u.id===String(id)).loaded,loaded);
  s=leave(s,b);assert.equal(s.resources.cartridges,300);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
 }
});

test('a packed loaded gun that remains stored does not add its round to shared stock',()=>{
 let {s,b}=entered();const u=b.units.find(u=>u.id==='10'),loaded=u.loaded;
 b=act(b,{type:'drop',unitId:'10',item:'primary'});s=leave(s,b);s=take(s,model(s,10).entries.find(row=>row.loaded===loaded),1,10);
 const reserve=s.resources.cartridges;s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.retiro);s=leave(s,b);
 assert.equal(s.resources.cartridges,reserve);assert.ok(Object.values(s.operativeState[10].inventory).some(item=>item.loaded===loaded));
 const bad=order(s,{type:'visitSector'});for(const value of [-1,1.5,Infinity]){const damaged=structuredClone(bad);damaged.pendingBattle.storedCartridges=value;assert.throws(()=>restoreCampaign(serializeCampaign(damaged)));}
});


test('moving a loaded gun between packs and ground never credits it twice, and capture retains custody',()=>{
 const request={squad:[{id:'p'},{id:'q'}],issuedCartridges:0,storedCartridges:1,fieldCartridges:0};
 const entries=[{unitId:'p',kind:'resident'},{unitId:'q',kind:'resident'}];
 const snapshot={units:[{id:'p',side:'player',loaded:0,ammo:0,inventory:{}},{id:'q',side:'player',loaded:0,ammo:0,inventory:{gun:{weapon:1800,loaded:1,count:1}}}],groundItems:[],droppedWeapons:[],props:[],tiles:[]};
 assert.equal(planReturnAmmunition(request,snapshot,entries).creditedCartridges,0);
 snapshot.units[1].inventory={};snapshot.groundItems=[{type:'item',item:'weapon',weapon:1800,loaded:1,count:1}];assert.equal(planReturnAmmunition(request,snapshot,entries).creditedCartridges,0);
 snapshot.groundItems=[];snapshot.units[1].loaded=1;assert.equal(planReturnAmmunition(request,snapshot,entries).creditedCartridges,1);
 entries[1].kind='captured';const captive=planReturnAmmunition(request,snapshot,entries);assert.equal(captive.creditedCartridges,0);assert.deepEqual(captive.custody.q,{loaded:1,ammo:0});
});
