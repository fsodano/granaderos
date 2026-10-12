import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {unitAmmunitionByType,totalAmmoCounts} from '../game/physical-ammunition.js';
import {rosterFor,dispatchCampaign} from '../game/campaign.js';
import {fightCreatedNorthernDefense} from './fresh-northern-fixture.mjs';

function earnedDefense(){
 const stem='./fixtures/created-northern-earned-roof-defense-71bccb52';
 const proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url),'utf8'));
 const packed=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(packed),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha(packed),proof.gzipSha256);assert.equal(sha(raw),proof.inputSha256);
 return decodeSave(raw.toString()).campaign;
}

test('the earned created Córdoba defense keeps paid roof cover through a native victory and retains its real casualty and wounds',()=>{
 const start=earnedDefense(),before=structuredClone(start),initial=enterSector(start.pendingBattle,start.sectorStates.cordoba);
 assert.equal(start.pendingBattle.defenseGroupId,'enemy-group-2');assert.equal(start.pendingBattle.squad.length,11);
 const roofs=initial.units.filter(unit=>unit.side==='player'&&unit.hp>0&&unit.tacticalLevel>0);assert.equal(roofs.length,6,'ordinary earlier preparation actually staged six paid defenders on roofs');
 const {campaign,summary}=fightCreatedNorthernDefense(start);
 assert.equal(summary.status,'victory');assert.equal(summary.actions,103);assert.equal(summary.turns,11);assert.equal(summary.elapsedSeconds,128);
 assert.equal(campaign.hour,294);assert.equal(campaign.secondOfHour,3483);assert.equal(campaign.resources.treasury,start.resources.treasury);
 assert.equal(campaign.pendingBattle,null);assert.equal(campaign.pendingEncounter,null);assert.equal(campaign.defeated,false);assert.equal(campaign.sectors.cordoba.owner,'patriot');
 assert.equal(campaign.enemyGroups.find(group=>group.id==='enemy-group-2').status,'defeated');assert.ok(campaign.encounterHistory.some(event=>event.groupId==='enemy-group-2'&&event.outcome==='victory'));
 const deployed=start.pendingBattle.squad.map(unit=>unit.id),survivors=deployed.filter(id=>campaign.operativeState[id].alive),deaths=deployed.filter(id=>!campaign.operativeState[id].alive);
 assert.deepEqual(deaths,[121]);assert.equal(survivors.length,10);assert.equal(campaign.operativeState[121].hp,0);assert.equal(campaign.sectorStates.cordoba.units.find(unit=>unit.id==='121').hp,0);
 const deadDeployment=dispatchCampaign(campaign,{type:'squad',ids:[121]});assert.ok(deadDeployment.lastError,'the actual corpse cannot return to a field squad');assert.equal(deadDeployment.operativeState[121].alive,false);assert.deepEqual(deadDeployment.squads,campaign.squads);
 for(const id of survivors)assert.deepEqual(campaign.contracts[id],start.contracts[id],'defending does not renew or replace the actual paid term');
 for(const roof of roofs.filter(unit=>campaign.operativeState[Number(unit.id)].alive)){
  const retained=campaign.sectorStates.cordoba.units.find(unit=>unit.id===roof.id);
  assert.deepEqual({x:retained.x,y:retained.y,level:retained.tacticalLevel},{x:roof.x,y:roof.y,level:roof.tacticalLevel},'the actual roof guard remains at its previously paid cover');
 }
 const ammunition=state=>{const roster=rosterFor(state);return survivors.reduce((total,id)=>total+totalAmmoCounts(unitAmmunitionByType(carriedAmmunition(roster.find(op=>op.id===id),state.operativeState[id]))),0);};
 assert.ok(ammunition(campaign)<ammunition(start),'the native defense spends the survivors actual cartridges');
 assert.equal(campaign.operativeState[125].hp,34);assert.equal(campaign.operativeState[144].hp,24);assert.ok(campaign.operativeState[125].hp<campaign.operativeState[125].maxHp);assert.ok(campaign.operativeState[144].hp<campaign.operativeState[144].maxHp);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(campaign.operativeState[id].alive,false);
 assert.equal(campaign.operativeState[146].location,'buenos_aires');assert.equal(campaign.operativeState[146].hp,start.operativeState[146].hp);assert.deepEqual(campaign.contracts[146],start.contracts[146]);
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);assert.deepEqual(start,before);
});
