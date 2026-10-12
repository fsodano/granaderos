import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign} from '../game/campaign.js';
import {recoverNorthernLocalPatients} from './fresh-northern-fixture.mjs';

const fixture=()=>{
 const stem='./fixtures/created-northern-earned-local-care-55dbe6ad';
 const proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url),'utf8'));
 const packed=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(packed),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha(packed),proof.gzipSha256);assert.equal(sha(raw),proof.inputSha256);
 return decodeSave(raw.toString()).campaign;
};

test('earned Córdoba clinic care resolves the real hour-150 raid with finite medicine, native deaths and saved continuation',()=>{
 const start=fixture(),before=structuredClone(start),events=[];
 assert.equal(start.hour,145);assert.equal(start.secondOfHour,3002);assert.equal(start.pendingEncounter,null);
 assert.equal(start.operativeState[127].hp,14);assert.equal(start.operativeState[127].alive,true);assert.equal(start.operativeState[139].medkits,2);
 const local=start.recruited.filter(id=>start.operativeState[id].alive&&start.operativeState[id].location==='cordoba');
 const medicalStock=state=>local.reduce((sum,id)=>sum+state.operativeState[id].medkits,0);
 const campaign=recoverNorthernLocalPatients(start,{report:event=>events.push(event)});
 const defenses=events.filter(event=>event.event==='northernLocalCareDefense');assert.equal(defenses.length,1);
 const defense=defenses[0],care=events.find(event=>event.event==='northernLocalCare');
 assert.equal(defense.groupId,'enemy-group-1');assert.equal(defense.summary.status,'victory');assert.equal(defense.summary.actions,215);assert.equal(defense.summary.turns,18);
 assert.equal(defense.summary.officialReplay,true);assert.equal(defense.summary.officialMidpoint,true);assert.deepEqual(defense.summary.deaths,[127,108]);
 assert.deepEqual(defense.medicalOrders,[{type:'useItem',unitId:'108',targetId:'108'},{type:'useItem',unitId:'108',targetId:'108'}]);
 assert.deepEqual(defense.fieldAid.steps,[],'healthy actual survivors receive no invented postcombat treatment');
 assert.equal(care.doctor,139);assert.deepEqual(care.initialPatients,[127]);assert.deepEqual(care.patients,[]);assert.equal(care.dressingsUsed,5);
 assert.equal(medicalStock(start)-medicalStock(campaign),7,'five clinic strokes and two native combat strokes spend the actual carried dressing pool');
 assert.equal(campaign.resources.treasury,start.resources.treasury);assert.equal(care.paid,0);assert.equal(campaign.hour,150);assert.equal(campaign.secondOfHour,3518);
 assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.pendingBattle,null);assert.equal(campaign.defeated,false);assert.equal(campaign.sectors.cordoba.owner,'patriot');
 for(const id of [127,108]){assert.equal(campaign.operativeState[id].hp,0);assert.equal(campaign.operativeState[id].alive,false);assert.ok(!campaign.squad.includes(id));assert.equal(campaign.sectorStates.cordoba.units.find(unit=>unit.id===String(id)).hp,0);}
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(campaign.operativeState[id].alive,false);
 for(const id of local.filter(id=>campaign.operativeState[id].alive)){assert.equal(campaign.operativeState[id].hp,campaign.operativeState[id].maxHp);assert.equal(campaign.operativeState[id].bleeding,0);assert.deepEqual(campaign.contracts[id],start.contracts[id]);}
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);assert.deepEqual(start,before);
 const continued=dispatchCampaign(campaign,{type:'wait',hours:1});assert.equal(continued.lastError,null);assert.equal(continued.hour,151);assert.equal(continued.secondOfHour,3518);
 assert.equal(continued.operativeState[127].alive,false);assert.equal(continued.operativeState[108].alive,false);assert.equal(medicalStock(continued),medicalStock(campaign));assert.deepEqual(decodeSave(encodeSave(continued)).campaign,continued);
});
