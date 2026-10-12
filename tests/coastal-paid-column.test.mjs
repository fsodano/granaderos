import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {incomeSummary} from '../game/economy.js';
import {ammoCount,primaryAmmoTypeFor} from '../game/ammo-types.js';
import {preparePaidCoastalColumn} from './coastal-paid-column.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const clock=c=>c.hour*3600+(c.secondOfHour??0);
function fixture(){
 const stem='./fixtures/earned-stock-coast-retiro-supply',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),gzip=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(gzip);
 assert.equal(sha(gzip),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);
 return decodeSave(raw.toString()).campaign;
}

test('eight actual returned veterans recover finite local kit, pay ordinary contracts and arrive in two real coastal columns',t=>{
 const start=fixture(),before=structuredClone(start),result=preparePaidCoastalColumn(start,{count:8}),{receipt,ids}=result;
 let c=result.campaign;
 assert.deepEqual(ids,[134,104,101,117,108,121,102,129]);
 assert.equal(receipt.bookings.length,8);assert.equal(receipt.bookings.reduce((sum,row)=>sum+row.cost,0),561);
 assert.equal(start.resources.treasury-c.resources.treasury,561);assert.equal(receipt.renewals.length,0);
 assert.equal(receipt.origin,'mendoza');assert.equal(receipt.destination,'buenos_aires');assert.equal(receipt.squadIds.length,2);
 assert.deepEqual(receipt.squadIds.map(id=>c.squads.find(q=>q.id===id).members.length),[6,2]);
 for(const row of receipt.bookings){assert.equal(row.quote.available,true);assert.equal(row.quote.topTier,false);assert.equal(row.destination,'mendoza');}
 assert.equal(receipt.recovered.length,8);
 for(const row of receipt.recovered){
  assert.ok(start.operativeState[row.operativeId].serviceEquipmentReturn);assert.equal(c.operativeState[row.operativeId].serviceEquipmentReturn,undefined);
  assert.equal(row.collectorId,2);assert.equal(row.site,'mendoza');
  assert.equal(row.orders.filter(a=>a.direction==='take').length,row.items.length);assert.equal(row.orders.filter(a=>a.direction==='drop').length,row.items.length);
 }
 for(const route of receipt.routes){assert.equal(route.hours,8);assert.deepEqual(route.path,['mendoza','cordoba','buenos_aires']);}
 for(const id of ids){
  const r=c.operativeState[id],op=rosterFor(c).find(op=>op.id===id),unit=carriedAmmunition(op,r);assert.equal(r.location,'mendoza');assert.equal(r.alive,true);assert.equal(r.hp,r.maxHp);assert.equal(unit.loaded,1);assert.equal(ammoCount(unit),15);assert.ok(primaryAmmoTypeFor(unit));assert.equal(r.weaponDropped,false);
  for(const slot of ['headwear','outfit','legwear'])assert.ok(r[slot].condition>0);assert.ok(op.blade>0);
  assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c)+8*3600);
 }
 assert.equal(c.activeSquadId,start.activeSquadId);assert.equal(c.location,'retiro');
 const queuedAt=clock(c),queuedCash=c.resources.treasury,daily=incomeSummary(c).daily;
 assert.equal(daily,8000);
 for(let attempt=0;attempt<32&&receipt.squadIds.some(id=>c.squads.find(q=>q.id===id).journey);attempt++){
  c=dispatchCampaign(c,{type:'wait',hours:1});assert.equal(c.lastError,null);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 }
 assert.equal(clock(c)-queuedAt,8*3600);assert.equal(c.resources.treasury,queuedCash+daily-40,'two actual two-leg postal columns pay40 pesos while the agreed capital pays its one crossed midnight');
 const payments=c.log.filter(row=>row.hour>start.hour&&row.hour<=c.hour&&/^Los puertos acordados aportaron \d+ pesos a la tesorería\.$/.test(row.text));
 assert.deepEqual(payments.map(row=>({hour:row.hour,text:row.text})),[{hour:1464,text:'Los puertos acordados aportaron 8000 pesos a la tesorería.'}]);
 for(const id of ids){assert.equal(c.operativeState[id].location,'buenos_aires');assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));}
 for(const id of receipt.squadIds){assert.equal(c.squads.find(q=>q.id===id).journey,undefined);assert.equal(c.squads.find(q=>q.id===id).location,'buenos_aires');}
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 assert.equal(c.activeSquadId,start.activeSquadId);assert.equal(c.location,start.location);assert.equal(c.completed,false);assert.equal(c.defeated,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({scope:'Earned eight-person paid local preparation and actual arrival; no native victory or ending claim',ids,wages:561,columns:[6,2],hours:8,postalCost:40,agreedMidnightIncome:8000,finiteReturnOwners:receipt.recovered.length,clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,officialSave:true}));
});
