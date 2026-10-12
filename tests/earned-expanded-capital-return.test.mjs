import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {baseMorale} from '../game/morale.js';
import {rosterFor} from '../game/campaign.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoCount} from '../game/ammo-types.js';
import {prepareCreatedExpandedCapitalReturn} from './created-expanded-capital-return.mjs';

const sha=v=>createHash('sha256').update(v).digest('hex'),sorted=ids=>ids.slice().sort((a,b)=>a-b);

test('the actual river survivors and three paid restored veterans reach a twelve-person capital request with finite stock, exact empty guns and a real commander reserve',t=>{
 const stem='./fixtures/earned-coastal-river-victory',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),blob=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(blob);
 assert.equal(sha(blob),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);
 const start=decodeSave(raw.toString()).campaign,before=structuredClone(start),events=[],c=prepareCreatedExpandedCapitalReturn(start,{report:e=>events.push(e)}),field=c.pendingBattle.squad.map(u=>u.id),old=start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured);
 assert.deepEqual(start,before);assert.equal(sha(JSON.stringify(start)),proof.campaignSha256);assert.equal(c.pendingEncounter,null);
 const bookings=events.filter(e=>e.event==='expandedCapitalVeteranHired');assert.equal(bookings.length,3);assert.deepEqual(bookings.map(e=>e.id),[105,145,109]);assert.equal(bookings.reduce((sum,e)=>sum+e.quote.total,0),175980);
 for(const e of bookings){assert.equal(e.quote.available,true);assert.equal(e.treasuryBefore-e.treasuryAfter,e.quote.total);assert.equal(c.operativeState[e.id].serviceEquipmentReturn,undefined);}
 assert.equal(field.length,12);assert.deepEqual(sorted(field),sorted([...old.filter(id=>id!==57),...bookings.map(e=>e.id)]));assert.ok(c.pendingBattle.assaultSquads.every(q=>q.members.length<=6));
 const income=events.find(e=>e.event==='expandedCapitalReliefFunded');assert.ok(income.treasury>=income.required);assert.equal(income.serviceWeeks,6);
 const medical=events.find(e=>e.event==='expandedCapitalMedicalCourierComplete');assert.equal(medical.source,'ensenada');assert.ok(medical.needed>0&&medical.needed<=35);
 assert.equal(events.filter(e=>e.event==='expandedCapitalMedicalSource').reduce((sum,e)=>sum+e.count,0),medical.needed);assert.ok(medical.carried>=60);
 assert.ok(events.filter(e=>e.event==='routeBatteryDetour').length>=2,'Both real courier journeys must admit the ordinary capital bypass.');
 assert.ok(events.filter(e=>e.event==='routeBatteryTravelOrder'&&e.action.type==='travel').every(e=>e.action.sector!=='buenos_aires'));
 assert.equal(c.operativeState[57].location,'cordoba');assert.ok(c.recruited.includes(57)&&c.operativeState[57].alive);assert.equal(c.operativeState[57].hp,c.operativeState[57].maxHp);assert.ok(!field.includes(57));
 for(const id of [...field,57]){const r=c.operativeState[id],op=rosterFor(c).find(op=>op.id===id);assert.ok(c.recruited.includes(id)&&r.alive&&!r.captured);assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);assert.equal(r.energy,100);assert.equal(r.fatigue,0);assert.equal(r.asleep,false);assert.ok(r.morale>=baseMorale(op));const expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(expiry===null||expiry>c.hour*3600+(c.secondOfHour??0));
  if(id!==57){const u=carriedAmmunition(op,r);assert.ok(!r.weaponDropped&&[1800,1801,1802].includes(op.weapon));assert.ok(u.loaded+ammoCount(u)>=16);assert.equal(r.activeSlot,'primary');assert.ok(r.medkits>=5);for(const slot of ['headwear','outfit','legwear'])assert.ok(r[slot].condition>0);}
 }
 const guns=c.pendingBattle.artillery.filter(g=>!g.stationed);assert.equal(guns.length,3);assert.deepEqual(guns.map(g=>g.id).sort(),start.sectorStates.santa_fe.artillery.filter(g=>g.type==='bronze4').map(g=>g.id).sort());assert.ok(guns.every(g=>g.type==='bronze4'&&!g.loaded&&g.ammo===0));
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 const battle=enterSector(c.pendingBattle,c.sectorStates.buenos_aires);assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});assert.equal(c.completed,false);assert.equal(c.defeated,false);
 t.diagnostic(JSON.stringify({scope:'Actual expanded paid preparation, finite source/transport and official paired save only; native capital victory and full ending/48h remain open',field:field.length,bookings:bookings.map(e=>({id:e.id,cost:e.quote.total})),courierDressings:medical.needed,guns:3,clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury}));
});
