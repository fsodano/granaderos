import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {prepareRouteBattery,prepareRouteMixedBattery} from './route-battery.mjs';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
import {deployedArtillery} from '../game/equipment.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {rosterFor} from '../game/campaign.js';

// Existing control isolates real exploration and transport. It does not
// claim a fresh campaign victory or provide any artillery, ammunition or cash.
function controlled(){const s=initialCampaign();s.sectors.cordoba.owner='patriot';return s;}

test('route preparation discovers and forwards three real finite bronze guns with canonical saved custody',()=>{
 // A real paid reserve remains at Retiro while the existing crew carries the
 // guns. Its day term expires during transport unless explicitly retained.
 const checkpoint=controlled();
 // Opposing reserves are exhausted in this finite-custody transport checkpoint.
 checkpoint.enemyReserves.remaining={north:0,coast:0,interior:0};
 let start=order(checkpoint,{type:'advanceStrategicTime',seconds:17});
 const hire=contractQuote(start,rosterFor(start).find(op=>op.id===119),'day'),hireCash=start.resources.treasury;
 start=order(start,{type:'recruitCivic',id:119,term:'day',destination:'retiro'});assert.equal(start.resources.treasury,hireCash-hire.price);
 start=order(start,{type:'wait',hours:6});start=order(start,{type:'squad',ids:[3,4,10]});
 assert.equal(start.contracts[119].expiresSecond,17);assert.equal(start.operativeState[119].location,'retiro');assert.ok(!start.squad.includes(119));
 const before=structuredClone(start),events=[];
 const result=prepareRouteBattery(start,['bronze4','bronze4','bronze4'],{destination:'cordoba',keepServing:[119],report:event=>events.push(event)}),s=result.campaign;
 assert.deepEqual(start,before);assert.equal(s.location,'cordoba');assert.equal(ownedArtilleryCount(s),3);assert.equal(s.artilleryTransfers.length,0);
 assert.deepEqual(new Set(result.selections),new Set(['depot:arsenal:buenos_aires:1','depot:arsenal:cordoba:1','depot:arsenal:cordoba:2']));
 assert.ok(events.some(event=>event.event==='routeArsenalRecovered'&&event.sector==='buenos_aires'));assert.ok(events.some(event=>event.event==='routeArsenalRecovered'&&event.sector==='cordoba'));
 assert.equal(events.filter(event=>event.event==='routeBatteryShipment').length,1);assert.equal(events.filter(event=>event.event==='routeBatteryStored').length,2);
 const renewals=events.filter(event=>event.event==='routeBatteryRenewal');const requiredRenewals=Math.max(0,Math.floor((s.hour*3600+(s.secondOfHour??0)+2*3600-contractExpiresSeconds(before.contracts[119]))/86400)+1);
 assert.equal(renewals.length,requiredRenewals);assert.ok(renewals.length>0);assert.ok(renewals.every(event=>event.id===119&&event.price===hire.price));
 for(const gun of s.artilleryDepots.cordoba){assert.equal(gun.loaded,true);assert.equal(gun.ammo,6);}assert.ok(s.hour>0);assert.equal(s.resources.treasury,before.resources.treasury-180-renewals.reduce((sum,event)=>sum+event.price,0));
 assert.ok(s.recruited.includes(119));assert.equal(s.operativeState[119].location,'retiro');assert.equal(s.contracts[119].expiresSecond,17);assert.equal(contractExpiresSeconds(s.contracts[119]),contractExpiresSeconds(before.contracts[119])+renewals.length*86400);
 for(const key of ['hp','maxHp','bleeding','condition','ammo','carriedLoaded','medkits','inventory','outfit','headwear','legwear'])assert.deepEqual(s.operativeState[119][key],before.operativeState[119][key],`paid retention preserves remote ${key}`);
 const defaultEvents=[],normal=prepareRouteBattery(start,['bronze4','bronze4','bronze4'],{destination:'cordoba',report:event=>defaultEvents.push(event)}).campaign;
 assert.ok(!normal.recruited.includes(119),'default transport does not renew an unrelated reserve');assert.equal(normal.operativeState[119].alive,true);assert.equal(normal.contracts[119],undefined);assert.ok(normal.log.some(entry=>entry.text.includes('Benjamín Duarte concluye su contrato')));
 assert.deepEqual(normal.artilleryDepots.cordoba,s.artilleryDepots.cordoba);assert.equal(normal.resources.treasury,s.resources.treasury+renewals.reduce((sum,event)=>sum+event.price,0));assert.equal(defaultEvents.filter(event=>event.event==='routeBatteryRenewal').length,0);
 const expired=structuredClone(normal);assert.throws(()=>prepareRouteBattery(normal,['bronze4'],{keepServing:[119]}),/actual serving soldiers/);assert.deepEqual(normal,expired);
 assert.deepEqual(prepareRouteBattery(start,['bronze4','bronze4','bronze4'],{destination:'cordoba',keepServing:[119]}).campaign,s,'actual paid retention and physical transport replay exactly');
 assert.deepEqual(saved({campaign:s}).campaign,s);
 const next=prepareRouteBattery(s,['bronze4','bronze4','bronze4']);assert.deepEqual(next.campaign,s);assert.deepEqual(next.selections,result.selections);
 const ready=order(s,{type:'configureArtillery',types:result.selections});assert.deepEqual(deployedArtillery(ready).map(gun=>gun.id),s.artilleryDepots.cordoba.map(gun=>gun.id));
 const p=visit(ready);assert.deepEqual(p.battle.artillery,[]);assert.equal(ownedArtilleryCount(leave(p)),3);
});

test('a route cannot recover unknown, occupied or exhausted artillery sources or mutate its input on failure',()=>{
 const start=initialCampaign(),before=structuredClone(start),events=[];
 assert.throws(()=>prepareRouteBattery(start,['bronze4','bronze4'],{report:event=>events.push(event)}),/No remaining controlled physical arsenal/);assert.deepEqual(start,before);assert.equal(events.at(-1).event,'finiteBatteryUnavailable');
 assert.throws(()=>prepareRouteBattery(start,['bronze4'],{destination:'cordoba'}),/destination must be controlled/);assert.deepEqual(start,before);
 assert.throws(()=>prepareRouteBattery(start,['bogus']),/existing artillery types/);
});

test('mixed route batteries use five distinct finite pieces and cannot borrow reserved guns or invent extra swivels',()=>{
 const start=controlled();
 // This isolated transport scenario begins after the opposing reserve is
 // exhausted. It proves custody, rather than winning a fresh campaign.
 start.enemyReserves.remaining={north:0,coast:0,interior:0};
 const before=structuredClone(start),events=[];
 const first=prepareRouteMixedBattery(start,3,{destination:'cordoba',report:event=>events.push(event)});
 assert.deepEqual(first.records.map(g=>g.type),['swivel','bronze4','bronze4']);
 assert.equal(new Set(first.records.map(g=>g.id)).size,3);assert.deepEqual(start,before);
 const excluded=first.records.map(g=>g.id),second=prepareRouteMixedBattery(first.campaign,2,{destination:'cordoba',preferredTypes:['field8','bronze4','swivel'],excludeIds:excluded});
 assert.deepEqual(second.records.map(g=>g.type),['field8','bronze4']);assert.ok(second.records.every(g=>!excluded.includes(g.id)));
 const all=second.campaign.artilleryDepots.cordoba;
 assert.equal(all.length,5);assert.equal(new Set(all.map(g=>g.id)).size,5);assert.equal(all.filter(g=>g.type==='swivel').length,1);
 assert.equal(all.reduce((sum,g)=>sum+g.ammo+Number(g.loaded),0),35);
 for(const gun of first.records)assert.deepEqual(all.find(g=>g.id===gun.id),gun,'Preparing reserve guns preserves the first battery exactly.');
 assert.deepEqual(saved({campaign:second.campaign}).campaign,second.campaign);
 assert.ok(events.some(event=>event.event==='routeMixedBatteryPrepared'&&event.records.every(g=>g.ammo===6&&g.loaded)));
 assert.throws(()=>prepareRouteBattery(second.campaign,['swivel'],{excludeIds:all.filter(g=>g.type==='swivel').map(g=>g.id)}),/No remaining controlled physical arsenal/);
 assert.deepEqual(start,before);
});
