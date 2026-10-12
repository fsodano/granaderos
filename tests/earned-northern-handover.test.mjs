import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign} from '../game/campaign.js';
import {prepareFreshNorthernHandover} from './fresh-northern-recovery.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const metadata=JSON.parse(readFileSync(new URL('./fixtures/earned-northern-handover.provenance.json',import.meta.url)));
function earnedInput(name){
 const record=metadata.records[name],bytes=readFileSync(new URL(`./fixtures/earned-northern-handover-${name}.save.json.gz`,import.meta.url)),raw=gunzipSync(bytes);
 assert.equal(sha(bytes),record.compressedSha256);assert.equal(sha(raw),record.sha256);assert.equal(raw.length,record.rawBytes);
 const campaign=decodeSave(raw.toString()).campaign;assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);return campaign;
}

test('the earned Salta handover interruption admits the actual local enemy and preserves the departed envoy journey',()=>{
 const c=earnedInput('counterattack'),before=structuredClone(c),expected=metadata.counterattack;
 assert.deepEqual([c.hour,c.secondOfHour],expected.clock);assert.equal(c.location,expected.location);
 assert.deepEqual(c.pendingEncounter,{groupId:expected.groupId,sector:expected.sector,arrivedAt:516});
 const group=c.enemyGroups.find(group=>group.id===expected.groupId),envoy=c.squads.find(q=>q.id===expected.envoySquadId);
 assert.equal(group.status,'waiting');assert.equal(group.target,'salta');assert.equal(c.sectors.salta.owner,'patriot');
 assert.deepEqual(envoy.members,expected.members);assert.equal(envoy.location,expected.location);assert.equal(envoy.journey.status,'moving');assert.equal(envoy.journey.path.at(-1),'tucuman');
 assert.ok(c.squads.some(q=>q.location==='salta'&&q.members.length));
 const refused=dispatchCampaign(c,{type:'visitMission',mission:'yatasto'});assert.match(refused.lastError,/encuentro|patrulla/i);
 for(const key of ['hour','secondOfHour','operativeState','resources','squads','pendingEncounter','enemyGroups'])assert.deepEqual(refused[key],c[key],`A blocked mission cannot change ${key}.`);
 assert.deepEqual(c,before);
});

test('earned Salta victory retains its real local reserve, wins its counterattack and resumes the same saved envoy journey',t=>{
 const start=earnedInput('salta-victory'),before=structuredClone(start),events=[];
 const {campaign:c,envoy}=prepareFreshNorthernHandover(start,{report:event=>events.push(event)});
 assert.deepEqual(start,before);assert.equal(c.location,'tucuman');assert.equal(c.phase,2);assert.equal(c.completed,false);assert.equal(c.defeated,false);
 const travel=events.find(event=>event.event==='northernHandoverTravel'),input=events.find(event=>event.event==='northernHandoverDefenseInput'),defense=events.find(event=>event.event==='northernHandoverDefenseReplay');
 assert.ok(travel&&input&&defense);assert.equal(events.some(event=>event.event==='routeHireBooked'),false,'The native local reserve wins without additional paid or inserted defenders.');
 assert.equal(input.campaign.pendingBattle.defenseGroupId,'enemy-group-4');
 assert.deepEqual(input.battle.units.filter(u=>u.side==='player').map(u=>Number(u.id)),[110,127,104,140,9,11]);
 const gunFields=gun=>({id:gun.id,type:gun.type,side:gun.side,loaded:gun.loaded,ammo:gun.ammo});
 assert.deepEqual(input.battle.artillery.map(gunFields),before.sectorStates.salta.artillery.map(gunFields),'The original exhausted piece stays in the actual scene; no gun or ammunition is supplied.');
 assert.equal(input.battle.artillery.length,1);assert.equal(input.battle.artillery[0].id,'arsenal:cordoba:2');
 assert.equal(input.battle.artillery[0].loaded,false);assert.equal(input.battle.artillery[0].ammo,0);
 assert.equal(defense.orders.some(action=>['artilleryFire','artilleryReload'].includes(action.type)),false,'The infantry must win without firing the exhausted cannon.');
 assert.ok(!input.battle.units.some(u=>u.side==='player'&&[1,0,8].includes(Number(u.id))),'The departed envoy party is not inserted into a remote defense.');
 assert.equal(defense.status,'victory');assert.equal(defense.exactSavedReplay,true);assert.deepEqual(defense.losses,defense.units.filter(u=>u.side==='player'&&u.hp<=0).map(u=>Number(u.id)));for(const id of defense.losses)assert.equal(c.operativeState[id].alive,false);
 assert.equal(c.sectors.salta.owner,'patriot');assert.equal(c.enemyGroups.find(group=>group.id==='enemy-group-4').status,'defeated');
 assert.ok(c.encounterHistory.some(row=>row.groupId==='enemy-group-4'&&row.outcome==='victory'));
 const originalJourney=travel.campaign.squads.find(q=>q.id===travel.envoySquad).journey;
 const defenseSeconds=(defense.campaign.hour-input.campaign.hour)*3600+(defense.campaign.secondOfHour??0)-(input.campaign.secondOfHour??0);
 assert.ok(defenseSeconds>0&&defenseSeconds<3600);
 // Tactical time also belongs to the moving remote party. Preserve the same
 // path and start, including its real partial-second progress during care.
 assert.deepEqual(defense.envoyJourney,{...originalJourney,pendingSeconds:(originalJourney.pendingSeconds??0)+defenseSeconds,elapsedSecond:(originalJourney.elapsedSecond??0)+defenseSeconds},'Native settlement retains the departed journey and records its exact elapsed tactical seconds.');
 assert.equal(c.activeSquadId,travel.envoySquad);assert.equal(c.squads.find(q=>q.id===c.activeSquadId).journey,undefined);
 assert.equal(envoy,1);assert.deepEqual(c.squad,[1,0,8]);
 for(const id of c.squad){assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].location,'tucuman');}
 for(const unit of defense.units.filter(u=>u.side==='player'&&u.hp>0)){assert.equal(c.operativeState[Number(unit.id)].alive,true);assert.ok(c.operativeState[Number(unit.id)].hp>=15);assert.equal(c.operativeState[Number(unit.id)].bleeding,0);}
 const slots=new Map(input.battle.units.filter(u=>u.side==='player').map(u=>[u.id,u.activeSlot]));let medicalStrokes=0;
 for(const action of defense.orders){if(action.type==='weapon')slots.set(action.unitId,action.slot);if(action.type==='useItem'&&slots.get(action.unitId)==='medical')medicalStrokes++;}
 const medkits=units=>units.filter(u=>u.side==='player').reduce((sum,u)=>sum+(u.medkits??0),0);
 assert.equal(medkits(c.sectorStates.salta.units),medkits(input.battle.units)-medicalStrokes,'Every actual first-aid stroke spends one of the original carried dressings.');
 assert.deepEqual(c.sectorStates.salta.artillery.map(gunFields),before.sectorStates.salta.artillery.map(gunFields));
 for(const [id,r]of Object.entries(before.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 const renewals=events.filter(event=>event.event==='northernHandoverRenewal');for(const row of renewals)assert.equal(row.cost,row.quote.price);
 assert.equal(c.resources.treasury,start.resources.treasury-300-renewals.reduce((sum,row)=>sum+row.cost,0),'This pre-midnight handover pays its actual pact and retention once.');
 // Earlier San Lorenzo care is separate. This bounded proof must preserve
 // the carried fatal wound and must not claim the later conference completed.
 for(const key of ['hp','alive','bleeding','bandaged'])assert.equal(c.operativeState[57][key],before.operativeState[57][key]);
 assert.equal(c.operativeState[57].hp,17);assert.equal(c.operativeState[57].bleeding,6);assert.equal(c.missions.yatasto,undefined);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 t.diagnostic(JSON.stringify({scope:'Earned Salta defense and departed envoy arrival only. San Lorenzo ally aid and a fresh complete campaign remain separate.',inputSha256:metadata.records['salta-victory'].sha256,additionalHires:0,defense:{turns:defense.turns,actions:defense.actions,seconds:defense.elapsedSeconds,losses:defense.losses,exactSavedReplay:defense.exactSavedReplay,aid:defense.aid,medicalStrokes,medkitsBefore:medkits(input.battle.units),medkitsAfter:medkits(c.sectorStates.salta.units)},journeyPreserved:true,finishClock:[c.hour,c.secondOfHour],treasury:c.resources.treasury}));
});
