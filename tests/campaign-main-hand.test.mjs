import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {handLayout} from '../game/hand-layout.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
function fresh(){const s=order(initialCampaign(8),{type:'createOfficer',name:'Testigo',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});Object.assign(s.operativeState[1000],{inventory:{note:{name:'Carta',count:1,weight:.1,condition:44,instanceId:'map-note'},key:{kind:'tool',toolKey:'key',keyId:'gate',count:1,weight:.2,condition:57,instanceId:'map-key'}}});return s;}
const model=s=>sectorInventoryModel(s,'retiro',rosterFor(s),1000);
const row=(s,item)=>model(s).carried.find(row=>row.item===item);
const action=(s,item)=>({type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'equip',...row(s,item).mainhand.action});
const prepare=(s,item)=>{assert.equal(row(s,item).mainhand.valid,true,row(s,item).mainhand.reason);return order(s,action(s,item));};
const save=s=>{assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);return s;};
const unchanged=s=>({...s,lastError:null});
function reject(s,a){const n=dispatchCampaign(s,a);assert.ok(n.lastError);assert.deepEqual(unchanged(n),unchanged(s));}

test('campaign prepares actual bandages, tools, supplies and objects without time, healing or stock changes',()=>{
 let s=fresh();const before=structuredClone(s),r0=s.operativeState[1000];assert.ok(model(s).reason);assert.equal(model(s).carriedReason,null);
 for(const [item,slot,key,value] of [['medkits','medical'],['torches','supply','activeSupply','torches'],['inventory:key','tool','activeTool','inventory:key'],['inventory:note','item','activeItem','inventory:note'],['flints','item','activeItem','flints'],['primary','primary']]){
  s=prepare(s,item);const r=s.operativeState[1000];assert.equal(r.activeSlot,slot);if(key)assert.equal(r[key],value);
  for(const field of ['activeTool','activeSupply','activeItem'])if(field!==key)assert.equal(r[field],undefined);
  assert.equal(row(s,item).mainhand.valid,false);assert.match(row(s,item).mainhand.label,/En mano principal/);
  for(const field of ['inventory','medkits','torches','flints','hp','energy','carriedLoaded','carriedAmmo'])assert.deepEqual(r[field]??(field==='carriedAmmo'?0:undefined),r0[field]??(field==='carriedAmmo'?0:undefined),field);
  for(const field of ['hour','secondOfHour','seed','resources','sectorStates','sceneStates'])assert.deepEqual(s[field],before[field]);save(s);
 }
});

test('main-hand choices survive full save, deployment and return with the same object and independent left hand',()=>{
 let s=prepare(fresh(),'medkits');const second=row(s,'torches').offhand;assert.equal(second.valid,true);s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'equip',...second.action});s=prepare(s,'inventory:note');assert.equal(s.operativeState[1000].leftHandItem,'torches');
 s=order(save(s),{type:'visitSector'});const b=enterSector(s.pendingBattle),u=b.units.find(u=>u.id==='1000');assert.equal(handLayout(u).right,'inventory:note');assert.equal(handLayout(u).left,'torches');assert.equal(u.inventory.note.instanceId,'map-note');assert.equal(u.inventory.note.condition,44);assert.ok(u.loaded>0,'initial loading must remain unchanged by a hand selection');assert.deepEqual(decodeSave(encodeSave(s,b)).battle,b);
 s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});save(s);s=prepare(s,'torches');assert.equal(s.operativeState[1000].leftHandItem,null);assert.equal(s.operativeState[1000].activeSupply,'torches');assert.equal(s.operativeState[1000].activeItem,undefined);save(s);
});

test('prepared partial reload remains exact when a tool is readied and the gun is selected again',()=>{
 let s=fresh();Object.assign(s.operativeState[1000],{carriedLoaded:0,carriedAmmo:2,carriedReloadProgress:.5});const stock=s.resources.cartridges;
 s=prepare(s,'inventory:key');s=prepare(s,'primary');save(s);assert.equal(s.operativeState[1000].carriedReloadProgress,.5);assert.equal(s.operativeState[1000].carriedAmmo,2);assert.equal(s.resources.cartridges,stock);
 s=order(s,{type:'visitSector'});const u=enterSector(s.pendingBattle).units.find(u=>u.id==='1000');assert.equal(u.loaded,0);assert.equal(u.reloadProgress,.5);
});

test('moving a second pistol into the main hand preserves each gun and its load',()=>{
 let s=fresh();s.loadouts[1000]={weapon:1805,blade:1813};Object.assign(s.operativeState[1000],{carriedLoaded:1,carriedAmmo:3,condition:81,weaponInstanceId:'first-pistol',offHand:{weapon:1808,count:1,weight:1.3,loaded:2,condition:57,instanceId:'second-pistol'}});
 s=prepare(s,'offhand');const r=s.operativeState[1000];assert.equal(s.loadouts[1000].weapon,1808);assert.equal(r.weaponInstanceId,'second-pistol');assert.equal(r.carriedLoaded,2);assert.equal(r.carriedAmmo,4);assert.equal(r.condition,57);assert.equal(r.offHand.instanceId,'first-pistol');assert.equal(r.offHand.loaded,1);assert.equal(r.offHand.condition,81);save(s);
});

test('missing or changed objects, incapacitation, absence, occupation and pending visits reject atomically',()=>{
 const base=fresh(),a=action(base,'inventory:note');
 for(const mutate of [s=>s.operativeState[1000].inventory.note.condition=43,s=>delete s.operativeState[1000].inventory.note,s=>s.operativeState[1000].asleep=true,s=>s.operativeState[1000].hp=5,s=>s.operativeState[1000].energy=0,s=>s.sectors.retiro.owner='royalist',s=>s.squads[0].location='buenos_aires']){const s=structuredClone(base);mutate(s);reject(s,a);}
 for(const change of [{count:2},{inventoryKey:'missing'},{expected:undefined},{slot:'unknown'}])reject(base,{...a,...change});
 reject(order(base,{type:'visitSector'}),a);
 const s=prepare(base,'inventory:note');reject(s,action(s,'inventory:note'));
});

test('a full set of pockets rejects a main-hand selection that needs space for a long gun',()=>{
 const s=fresh(),r=s.operativeState[1000];s.loadouts[1000]={blade:0};Object.assign(r,{inventory:{},medkits:0,priming:0,flints:0,rations:0,boleadoras:0,torches:0});
 // Four large and eight small pockets are occupied while the long gun is held.
 for(let i=0;i<4;i++)r.inventory['large'+i]={count:1,weight:4};
 for(let i=0;i<8;i++)r.inventory['small'+i]={count:1,weight:.1};
 const item='inventory:small0';assert.equal(model(s).usage.overloaded,false);assert.equal(row(s,item).mainhand.valid,false);assert.match(row(s,item).mainhand.reason,/espacio/);reject(s,action(s,item));
});
