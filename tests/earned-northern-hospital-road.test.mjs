import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign} from '../game/campaign.js';
import {cellTravelPlan,worldOwner} from '../game/world-cells.js';
import {northernRecoveryHospital,recoverFreshNorthernHospital,northernHospitalOrder} from './fresh-northern-recovery.mjs';

function earnedInput(){
 const raw=gunzipSync(readFileSync(new URL('./fixtures/earned-northern-hospital-occupied-cordoba.campaign.json.gz',import.meta.url)));
 const metadata=JSON.parse(readFileSync(new URL('./fixtures/earned-northern-hospital-occupied-cordoba.provenance.json',import.meta.url)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),metadata.sha256);
 assert.equal(raw.length,metadata.rawBytes);
 const campaign=JSON.parse(raw),before=structuredClone(campaign),admitted=decodeSave(encodeSave(campaign)).campaign;
 assert.deepEqual(campaign,before,'admission must not rewrite the earned raw input');
 assert.deepEqual(decodeSave(encodeSave(admitted)).campaign,admitted);
 return {campaign:admitted,metadata};
}

test('earned wounded northern survivors select a controlled local hospital and retain the occupied road',()=>{
 const {campaign,metadata}=earnedInput(),before=structuredClone(campaign);
 assert.equal(campaign.hour,296);assert.equal(campaign.location,'tucuman');
 assert.deepEqual(metadata.patientIds,[103,111,125,141]);
 assert.equal(campaign.sectors.cordoba.owner,'royalist');
 assert.equal(campaign.enemyGroups.find(group=>group.id==='enemy-group-2').status,'stationed');
 assert.equal(northernRecoveryHospital(campaign,metadata.patientIds),'tucuman');
 assert.ok(cellTravelPlan(campaign,'cordoba').reason,'the real occupied hospital is unavailable');
 const plan=cellTravelPlan(campaign,'buenos_aires');
 assert.equal(plan.reason,null);assert.equal(plan.hours,61);
 assert.ok(plan.path.length>2&&plan.path.includes('san_nicolas'));
 assert.ok(plan.path.every(at=>worldOwner(campaign,at)!=='royalist'));
 assert.ok(!plan.path.includes('cordoba'));
 assert.deepEqual(campaign,before,'planning neither moves actors nor recaptures a locality');
});

test('earned northern hospital care and a saved rural sleep boundary retain finite supplies, real time and occupation',t=>{
 const {campaign:start,metadata}=earnedInput(),before=structuredClone(start),events=[],checkpoints=[];
 const report=event=>{if(event.event==='northernHospitalCheckpoint')checkpoints.push(event);else events.push(event);};
 const hospital=recoverFreshNorthernHospital(start,{report}),recovered=hospital.campaign;
 assert.deepEqual(start,before);
 assert.equal(hospital.sector,'tucuman');
 assert.equal(recovered.sectors.cordoba.owner,'royalist');
 assert.equal(recovered.enemyGroups.find(group=>group.id==='enemy-group-2').status,'stationed');
 assert.deepEqual(checkpoints.map(row=>row.stage),['stabilized','recovered']);
 for(const checkpoint of checkpoints)assert.deepEqual(decodeSave(encodeSave(checkpoint.campaign)).campaign,checkpoint.campaign);
 for(const id of metadata.patientIds){
  const r=recovered.operativeState[id];
  if(r.alive){assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);}
  else assert.ok(events.some(event=>event.event==='battleFinished'&&event.units.some(unit=>unit.id===String(id)&&unit.hp<=0)),'a new death needs its actual tactical result');
 }
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive){assert.equal(recovered.operativeState[id].alive,false);assert.equal(recovered.operativeState[id].hp,0);}
 assert.ok(recovered.hour>start.hour);
 assert.equal(recovered.contracts[1000].paid,300,'the existing relief questionnaire pays its actual fee once');
 const fortification=events.filter(event=>event.event==='hospitalFortification');
 assert.deepEqual(fortification.map(row=>row.cost),[150,150,150]);
 const collection=events.filter(event=>event.event==='northernHospitalFiniteCare');
 assert.ok(collection.length>0,'care must discover the existing local dressing cache when issued stock runs out');
 assert.equal(collection.reduce((sum,row)=>sum+row.quantity,0),12);
 assert.equal(recovered.sectorStates.tucuman.props.find(prop=>prop.id==='tucuman:building:chest:14:7').contents.filter(item=>item.item==='medkits').reduce((sum,row)=>sum+row.count,0),0);
 assert.ok(!events.some(event=>event.action?.type==='travel'&&event.action.sector==='cordoba'));
 t.diagnostic(JSON.stringify({hospitalHour:recovered.hour,careHours:events.filter(row=>row.event==='northernHospitalCareTick').length,paidRelief:events.filter(row=>row.event==='northernHospitalPaidRelief'),finiteCollection:collection,scope:'Bounded hospital and rural sleep; later hour408 guard raid and full return remain open.'}));
 let c=decodeSave(encodeSave(recovered)).campaign;
 const party=c.recruited.filter(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.location===hospital.sector&&!hospital.escort.includes(id);});
 assert.ok(party.length>0&&party.length<=6);
 const order=action=>{c=northernHospitalOrder(c,action,{report});};
 order({type:'squad',ids:party});
 for(const operativeId of party)order({type:'assignCare',operativeId,assignment:'active'});
 const refused=dispatchCampaign(c,{type:'travel',sector:'cordoba'});
 assert.equal(refused.lastError,'Cada escala debe ser una celda terrestre accesible.');
 assert.equal(refused.location,c.location);
 const departure=structuredClone(c);
 order({type:'travel',sector:'buenos_aires'});
 const q=()=>c.squads.find(q=>q.id===c.activeSquadId);
 assert.equal(q().journey.status,'paused');assert.equal(q().journey.reason,'exhausted');
 assert.equal(worldOwner(c,c.location),'neutral');
 assert.ok(c.hour>departure.hour&&c.hour<408,'this bounded leg stops before the still-unproved native raid');
 assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);
 assert.ok(q().journey.path.every(at=>worldOwner(c,at)!=='royalist'));
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c,'the actual fatigued journey admits its exact saved state');
 order({type:'cancelTravel',choice:'stop'});
 assert.equal(q().journey,undefined);
 const restRefusal=dispatchCampaign(c,{type:'assignCare',operativeId:party[0],assignment:'rest'});
 assert.equal(restRefusal.lastError,'La atención y el descanso necesitan un sector seguro.');
 for(const operativeId of party)if(!c.operativeState[operativeId].asleep)order({type:'setSleep',operativeId,asleep:true});
 assert.ok(party.every(id=>c.operativeState[id].asleep),'respect sleep already triggered by actual marching fatigue');
 const asleep=structuredClone(c),midpoint=decodeSave(encodeSave(c)).campaign;
 assert.deepEqual(midpoint,c);
 order({type:'wait',hours:1});
 const replay=northernHospitalOrder(midpoint,{type:'wait',hours:1});
 assert.deepEqual(replay,c,'the strict saved rural boundary continues through the same ordinary sleep tick');
 assert.ok(c.hour>asleep.hour&&c.hour<408);
 for(const id of party){assert.ok(c.operativeState[id].energy>asleep.operativeState[id].energy);assert.ok(c.operativeState[id].fatigue<asleep.operativeState[id].fatigue);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);}
 assert.equal(c.sectors.cordoba.owner,'royalist');
 assert.equal(c.enemyGroups.find(group=>group.id==='enemy-group-2').status,'stationed');
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].hp,0);}
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 assert.equal(c.completed,false,'the bounded hospital/road case does not claim campaign victory or full evacuation');

});
