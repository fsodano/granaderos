import {withStoredGear} from './commerce-gear-fixture.mjs';
import {secureArea} from './secured-area-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign as reduce,rosterFor,contractQuote,operativeLocation} from '../game/campaign.js';
import {defaultProfile} from '../game/character-profile.js';import {enterSector} from '../game/world.js';import {encodeSave,decodeSave} from '../game/save.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {extractItemQuantity} from '../game/tactical-inventory.js';
import {stackAmmunitionByType,unitAmmunitionByType} from '../game/physical-ammunition.js';
const step=(s,a)=>{const n=reduce(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const start=()=>step(secureArea(initialCampaign()),{type:'createOfficer',name:'Elena Valdés',profile:defaultProfile(),answers:{origin:'cabildo',doctrine:'guerrilla_tactician',crisis:'rally',specialty:'teacher',temperament:'steady'}});
const waitTo=(s,h)=>{while(s.hour<h)s=step(s,{type:'wait',hours:Math.min(240,h-s.hour)});return s;};
const roundTrip=(s)=>{s=step(s,{type:'visitSector'});const b=enterSector(s.pendingBattle,s.sectorStates[s.location]);const restored=decodeSave(encodeSave(s,b));return step(restored.campaign,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:restored.battle,survivors:restored.battle.units.filter(u=>u.side==='player').map(u=>({...u,id:Number(u.id)}))});};
test('established-area mixed terms survive field visit, expires, save, and depleted-kit rehire',()=>{
 let s=start();const terms=[[100,'day'],[101,'week'],[102,'month']];for(const[id,term]of terms)s=step(s,{type:'recruitCivic',id,term});s=withStoredGear(s,1803);s=step(s,{type:'equip',operativeId:100,slot:'weapon',itemId:1803});const storedOld=s.armory[1804];
 secureArea(s,['buenos_aires']);s=step(s,{type:'travel',sector:'buenos_aires'});assert.equal(s.hour,12);s=roundTrip(s);assert.deepEqual(s.recruited,[1000,100,101,102]);
 s=waitTo(s,23);
 const model=()=>sectorInventoryModel(s,'buenos_aires',rosterFor(s),100);
 const carried=model().personal,weapon=extractItemQuantity(carried,'primary',1).stack,ammunition=unitAmmunitionByType(carried),oldKeys=new Set(model().entries.map(row=>row.key));
 s=waitTo(s,24);assert.ok(!s.recruited.includes(100));assert.equal(operativeLocation(s,100),'buenos_aires');assert.equal(s.contracts[101].expiresAt,168);
 const returned=model().entries.filter(row=>!oldKeys.has(row.key));
 const gun=returned.find(row=>JSON.parse(row.expected).weapon===1803);assert.ok(gun);assert.deepEqual(JSON.parse(gun.expected),weapon);
 const returnedAmmunition=rows=>rows.reduce((totals,row)=>{for(const[type,count]of Object.entries(stackAmmunitionByType(JSON.parse(row.expected))))totals[type]=(totals[type]??0)+count;return totals;},{});
 assert.deepEqual(returnedAmmunition(returned),ammunition);
 for(const item of ['rations','medkits','boleadoras','torches'])assert.equal(returned.filter(row=>JSON.parse(row.expected).item===item).reduce((count,row)=>count+row.count,0),carried[item]);
 s=decodeSave(encodeSave(s)).campaign;const cash=s.resources.treasury;s=step(s,{type:'recruitCivic',id:100,term:'week'});assert.ok(s.resources.treasury<cash);
 assert.equal(rosterFor(s).find(o=>o.id===100).weapon,0);assert.equal(s.operativeState[100].carriedLoaded,0);assert.deepEqual(unitAmmunitionByType(model().personal),{});
 for(const item of ['rations','medkits','boleadoras','torches'])assert.equal(s.operativeState[100][item],0);
 assert.deepEqual(model().entries.filter(row=>!oldKeys.has(row.key)),returned);
 const receipt={type:'sectorInventory',sector:'buenos_aires',operativeId:100,direction:'take',sourceKey:gun.key,expected:gun.expected,count:1};
 s=step(s,receipt);const packed=model().carried.find(row=>row.inventoryKey&&JSON.parse(row.expected).weapon===1803);assert.ok(packed);
 s=step(s,{type:'sectorInventory',sector:'buenos_aires',operativeId:100,direction:'equip',inventoryKey:packed.inventoryKey,expected:packed.expected,slot:'primary'});
 assert.deepEqual(extractItemQuantity(model().personal,'primary',1).stack,weapon);assert.equal(rosterFor(s).find(o=>o.id===100).weapon,1803);
 const collected=s,repeated=reduce(s,receipt);assert.ok(repeated.lastError);assert.deepEqual({...repeated,lastError:null},{...collected,lastError:null});
 const remaining=model().entries.filter(row=>!oldKeys.has(row.key));assert.ok(!remaining.some(row=>row.key===gun.key));
 const conserved=returnedAmmunition(remaining);for(const[type,count]of Object.entries(unitAmmunitionByType(model().personal)))conserved[type]=(conserved[type]??0)+count;assert.deepEqual(conserved,ammunition);
 assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);assert.equal(s.armory[1804],storedOld);assert.deepEqual(Object.keys(s.resources),['treasury']);
 s=step(s,{type:'dismiss',id:100});s=waitTo(s,168);assert.deepEqual(s.recruited,[1000,102]);s=waitTo(s,720);assert.deepEqual(s.recruited,[1000]);assert.equal(s.defeated,false);assert.deepEqual(decodeSave(encodeSave(s)).campaign.recruited,[1000]);
});
test('prepaid month never triggers a second monthly payroll debit',()=>{
 const baseline=start();let paid=step(baseline,{type:'recruitCivic',id:102,term:'month'});const cost=baseline.resources.treasury-paid.resources.treasury;const control=waitTo(baseline,720);paid=waitTo(paid,720);assert.equal(paid.resources.treasury,control.resources.treasury-cost);assert.ok(!paid.recruited.includes(102));assert.ok(!paid.log.some(e=>e.text.includes('Se abonaron 0 pesos')));
});
test('trainer contract expiry releases reserved promotions without duplicating militia',()=>{
 let s=secureArea(start(),['buenos_aires','ensenada']);s=step(s,{type:'militia',trainerId:1000,rank:0});s=waitTo(s,s.militiaTraining[0].remaining);assert.equal(s.sectors.retiro.militia[0],3);s=step(s,{type:'recruitCivic',id:100,term:'day'});s=step(s,{type:'militia',trainerId:100,rank:1});assert.equal(s.sectors.retiro.militia[0],0);s=waitTo(s,s.contracts[100].expiresAt);assert.equal(s.militiaTraining.length,0);assert.deepEqual(s.sectors.retiro.militia,[3,0,0]);assert.ok(!s.recruited.includes(100));assert.deepEqual(decodeSave(encodeSave(s)).campaign.sectors.retiro.militia,[3,0,0]);
});
test('elite renewals bank days while funds last and week terms need real money',()=>{
 let s=start();const elite=rosterFor(s).find(o=>o.tier==='elite');
 const weekPrice=contractQuote(s,elite,'week').price;
 assert.ok(weekPrice>s.resources.treasury);
 assert.ok(reduce(s,{type:'recruitCivic',id:elite.id,term:'week'}).lastError);
 const dayPrice=contractQuote(s,elite,'day').price;
 assert.ok(dayPrice>s.resources.treasury);assert.ok(reduce(s,{type:'recruitCivic',id:elite.id,term:'day'}).lastError);
 // The starting budget cannot hire this elite even for one day. Fund only
 // that first service to isolate renewal and expiry from affordability.
 s.resources.treasury=dayPrice;
 s=step(s,{type:'recruitCivic',id:elite.id,term:'day'});
 assert.equal(s.resources.treasury,0);
 s.resources.treasury=weekPrice;
 const quote=contractQuote(s,elite,'day');s=step(s,{type:'renewContract',id:elite.id,term:'day'});
 assert.equal(s.contracts[elite.id].expiresAt,48);assert.equal(s.resources.treasury,weekPrice-quote.price);
 s=decodeSave(encodeSave(s)).campaign;assert.equal(s.contracts[elite.id].expiresAt,48);
 s=waitTo(s,48);assert.ok(!s.recruited.includes(elite.id));
});
