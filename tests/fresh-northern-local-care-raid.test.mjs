import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {careAssignmentReason} from '../game/medical-care.js';
import {recoverNorthernLocalPatients} from './fresh-northern-fixture.mjs';

const fixture=()=>{
 const stem='./fixtures/created-northern-earned-local-care-55dbe6ad';
 const proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url),'utf8'));
 const packed=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(packed),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(proof.sourceRevision,'55dbe6adad7bbefb065ced354b0c71cd82f6d8e2');
 assert.equal(proof.inputSha256,'e692a94d9c1dc9d58f59bb48951d5fe0e3e0a4dfbb2d369d1218b9d7be2ad415');
 assert.equal(sha(packed),proof.gzipSha256);assert.equal(sha(raw),proof.inputSha256);
 return decodeSave(raw.toString()).campaign;
};

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const campaignHash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const physicalMedicine=state=>{
 const scene=state.sectorStates.cordoba;
 return state.recruited.filter(id=>state.operativeState[id].alive&&state.operativeState[id].location==='cordoba').reduce((sum,id)=>sum+state.operativeState[id].medkits,0)+
  scene.units.filter(unit=>unit.hp===0&&!unit.departure&&!unit.fled).reduce((sum,unit)=>sum+(unit.medkits??0),0)+
  scene.groundItems.filter(item=>item.item==='medkits').reduce((sum,item)=>sum+item.count,0)+
  scene.props.flatMap(prop=>prop.contents??[]).filter(item=>item.item==='medkits').reduce((sum,item)=>sum+item.count,0);
};

// Dated earlier-helper oracle: 18 turns / 215 replay orders, deaths127/108,
// no surviving patients, five clinic dressings, final150:3518. The immutable
// earned input is retained above. Current expected values come from the
// independently captured 2e3c6d native input, tape, replay, settlement and care.

test('earned Córdoba clinic care resolves the real hour-150 raid with finite medicine, native deaths and saved continuation',()=>{
 const start=fixture(),before=structuredClone(start),events=[];
 assert.equal(start.hour,145);assert.equal(start.secondOfHour,3002);assert.equal(start.pendingEncounter,null);
 assert.equal(start.operativeState[127].hp,14);assert.equal(start.operativeState[127].alive,true);assert.equal(start.operativeState[139].medkits,2);
 const local=start.recruited.filter(id=>start.operativeState[id].alive&&start.operativeState[id].location==='cordoba');
 const medicalStock=state=>local.reduce((sum,id)=>sum+state.operativeState[id].medkits,0);
 const campaign=recoverNorthernLocalPatients(start,{report:event=>events.push(event)});
 const defenses=events.filter(event=>event.event==='northernLocalCareDefense');assert.equal(defenses.length,1);
 const defense=defenses[0],care=events.find(event=>event.event==='northernLocalCare');
 assert.equal(defense.groupId,'enemy-group-1');assert.equal(defense.summary.status,'victory');assert.equal(defense.summary.actions,236,'the legacy summary field counts replay orders');assert.equal(defense.summary.nativeActions,195);assert.equal(defense.summary.turns,22);assert.equal(defense.summary.elapsedSeconds,614);
 assert.equal(defense.summary.officialReplay,true);assert.equal(defense.summary.officialMidpoint,true);assert.deepEqual(defense.summary.deaths,[131,127]);
 assert.deepEqual(defense.medicalOrders,[{type:'useItem',unitId:'108',targetId:'108'},{type:'useItem',unitId:'108',targetId:'124'}]);
 assert.deepEqual(defense.fieldAid.steps,[],'the surviving field receives no invented postcombat treatment');assert.deepEqual(defense.fieldAid.after,defense.fieldAid.before);
 assert.deepEqual(defense.fieldAid.untreated,[{id:'npc:quiroga',name:'Facundo Quiroga',reason:'No hay un camino abierto hasta los heridos pendientes.'}],'the actual unreachable NPC is retained without claiming treatment');
 assert.equal(care.doctor,139);assert.deepEqual(care.initialPatients,[127]);assert.deepEqual(care.patients,[124,108]);assert.equal(care.dressingsUsed,18);
 const recovered=care.transfers.filter(row=>row.source).reduce((sum,row)=>sum+row.count,0);assert.equal(recovered,21);
 assert.equal(medicalStock(start),9);assert.equal(medicalStock(campaign),10);assert.equal(9+recovered-care.dressingsUsed-defense.medicalOrders.length,10,'finite recovered linen and carried donations pay every clinical and native dressing');
 assert.equal(physicalMedicine(start),37);assert.equal(physicalMedicine(campaign),17);assert.equal(physicalMedicine(start)-physicalMedicine(campaign),20,'all physical local linen loses exactly18 clinic and2 native dressings');
 assert.equal(campaign.resources.treasury,start.resources.treasury);assert.equal(care.paid,0);assert.equal(campaign.hour,164);assert.equal(campaign.secondOfHour,16);
 assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);assert.equal(campaign.defeated,false);assert.equal(campaign.sectors.cordoba.owner,'patriot');
 for(const id of [131,127]){assert.equal(campaign.operativeState[id].hp,0);assert.equal(campaign.operativeState[id].alive,false);assert.ok(!campaign.squad.includes(id));assert.equal(campaign.sectorStates.cordoba.units.find(unit=>unit.id===String(id)).hp,0);}
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive){assert.equal(campaign.operativeState[id].alive,false);assert.equal(campaign.operativeState[id].hp,0);assert.equal(campaign.operativeState[id].deathMinute,record.deathMinute);}
 assert.deepEqual(local.filter(id=>campaign.operativeState[id].alive),[123,124,134,139,108]);assert.equal(campaign.operativeState[139].medkits,10);assert.equal(careAssignmentReason(campaign,rosterFor(campaign).find(op=>op.id===139),'doctor'),'');
 for(const id of local.filter(id=>campaign.operativeState[id].alive)){assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp);assert.equal(campaign.operativeState[id].bleeding,0);assert.deepEqual(campaign.contracts[id],start.contracts[id]);}
 assert.deepEqual(campaign.contracts,start.contracts);assert.deepEqual(campaign.sectorStates.cordoba.artillery,start.sectorStates.cordoba.artillery);assert.equal(campaignHash(campaign),'830b8e3a6d7d42c746a7229f2e7c12c903468129683e931a8390c395e737d31f');
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);assert.deepEqual(start,before);
 const continued=dispatchCampaign(campaign,{type:'wait',hours:1});assert.equal(continued.lastError,null);assert.equal(continued.hour,165);assert.equal(continued.secondOfHour,16);
 assert.equal(continued.operativeState[131].alive,false);assert.equal(continued.operativeState[127].alive,false);assert.equal(continued.operativeState[108].alive,true);assert.equal(medicalStock(continued),medicalStock(campaign));assert.equal(physicalMedicine(continued),physicalMedicine(campaign));assert.deepEqual(continued.contracts,campaign.contracts);assert.deepEqual(continued.sectorStates.cordoba.artillery,campaign.sectorStates.cordoba.artillery);assert.deepEqual(decodeSave(encodeSave(continued)).campaign,continued);
});
