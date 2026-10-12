import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {rosterFor} from '../game/campaign.js';
import {baseMorale} from '../game/morale.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoCount} from '../game/ammo-types.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {fight} from './opening-driver.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {deployInfantryLine} from './battery-deployment-driver.mjs';
import {riverInfantryOrder} from './created-river-driver.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex'),sorted=ids=>ids.slice().sort((a,b)=>a-b);
const saved=c=>decodeSave(encodeSave(c)).campaign;

test('the genuinely paid twelve-person capital relief wins through public infantry orders, exact native replay and finite settlement while retaining five real deaths',t=>{
 const stem='./fixtures/earned-expanded-capital-assault',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),packed=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(packed);
 assert.equal(sha(packed),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);assert.equal(JSON.parse(raw).savedAt,proof.savedAt);
 const pair=decodeSave(raw.toString()),start=pair.campaign,before=structuredClone(start),field=start.pendingBattle.squad.map(u=>u.id),roster=rosterFor(start);
 assert.equal(sha(JSON.stringify(start)),proof.campaignSha256);assert.equal(sha(JSON.stringify(pair.battle)),proof.decodedBattleJsonSha256);
 assert.deepEqual(pair.battle,enterSector(start.pendingBattle,start.sectorStates.buenos_aires));
 assert.deepEqual(field,proof.fieldIds);assert.equal(field.length,12);assert.ok(start.pendingBattle.assaultSquads.every(q=>q.members.length<=6));
 assert.deepEqual([start.hour,start.secondOfHour,start.resources.treasury],[...proof.clock,proof.treasury]);assert.equal(start.blockade,true);assert.equal(start.pendingEncounter,null);
 for(const id of [...field,57]){
  const r=start.operativeState[id],op=roster.find(o=>o.id===id),expiry=contractExpiresSeconds(start.contracts[id]);
  assert.ok(start.recruited.includes(id)&&r.alive&&!r.captured);assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);assert.equal(r.energy,100);assert.equal(r.fatigue,0);assert.equal(r.asleep,false);assert.ok(r.morale>=baseMorale(op));assert.ok(expiry===null||expiry>start.hour*3600+start.secondOfHour);
  if(id!==57){const ammo=carriedAmmunition(op,r);assert.ok(!r.weaponDropped&&[1800,1801,1802].includes(op.weapon));assert.ok(ammo.loaded+ammoCount(ammo)>=16);assert.ok(r.medkits>=5);assert.equal(r.activeSlot,'primary');for(const slot of ['headwear','outfit','legwear'])assert.ok(r[slot].condition>0);}
 }
 assert.equal(start.operativeState[57].location,'cordoba');assert.ok(!field.includes(57));
 const guns=start.pendingBattle.artillery.filter(g=>!g.stationed).map(storedArtilleryRecord);assert.equal(guns.length,3);assert.deepEqual(guns,proof.emptyGunRecords);assert.ok(guns.every(g=>g.type==='bronze4'&&!g.loaded&&g.ammo===0));
 let executions=0,native;const executeBattle=(request,previous,options)=>{const result=fight(request,previous,options);executions++;native??=structuredClone(result.battle);return result;};
 const result=fightNorthernSector(start,'buenos_aires',{executeBattle,deploy:deployInfantryLine,controller:riverInfantryOrder}),c=result.campaign,expected=proof.nativeVictory;
 assert.deepEqual(start,before);assert.equal(executions,2);assert.equal(result.summary.status,'victory');assert.deepEqual([result.summary.turns,result.summary.actions,result.summary.elapsedSeconds],[expected.turns,expected.orders,expected.seconds]);
 assert.deepEqual([c.hour,c.secondOfHour,c.resources.treasury],[...expected.clock,expected.treasury]);assert.deepEqual(c.resources,start.resources);assert.deepEqual(c.recruited,start.recruited);
 assert.deepEqual(sorted(field.filter(id=>!c.operativeState[id].alive)),expected.deaths);assert.deepEqual(sorted(field.filter(id=>c.operativeState[id].alive)),expected.survivors.map(r=>r.id));
 for(const id of expected.deaths){const casualty=native.units.find(u=>u.id===String(id)),body=c.sectorStates.buenos_aires.units.find(u=>u.id===String(id));assert.equal(casualty.hp,0);assert.equal(c.operativeState[id].hp,0);assert.equal(c.operativeState[id].alive,false);assert.equal(body.hp,0);assert.equal(body.medkits,casualty.medkits);assert.deepEqual(body.inventory,casualty.inventory);assert.deepEqual([body.x,body.y],[casualty.x,casualty.y]);}
 for(const row of expected.survivors){const r=c.operativeState[row.id];assert.deepEqual([r.hp,r.maxHp,r.bleeding,r.location],[row.hp,row.maxHp,row.bleeding,'buenos_aires']);assert.ok(c.recruited.includes(row.id)&&!r.captured);}
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 assert.equal(c.operativeState[57].alive,true);assert.equal(c.operativeState[57].hp,start.operativeState[57].hp);assert.equal(c.operativeState[57].bleeding,0);assert.equal(c.operativeState[57].location,'cordoba');
 assert.equal(c.blockade,false);assert.equal(c.sectors.buenos_aires.owner,'patriot');assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);
 for(const id of proof.occupationGroupIds)assert.equal(c.enemyGroups.find(g=>g.id===id).status,'defeated');
 const retained=c.sectorStates.buenos_aires.artillery.filter(g=>g.side==='player').map(storedArtilleryRecord);assert.deepEqual(retained,guns);
 const allGuns=[...Object.values(c.artilleryDepots??{}).flat(),...Object.values(c.sectorStates).flatMap(s=>s.artillery??[]),...Object.values(c.sceneStates??{}).flatMap(s=>s.artillery??[]),...(c.artilleryTransfers??[]).map(g=>g.gun)];
 for(const gun of guns)assert.equal(allGuns.filter(g=>g.id===gun.id).length,1,'Each original empty gun has one physical settled owner.');
 const restored=saved(c);assert.deepEqual(restored,c);assert.equal(sha(JSON.stringify(restored)),expected.campaignSha256);
 t.diagnostic(JSON.stringify({scope:'Earned paid capital native victory, exact replay and saved finite settlement only; both fresh endings and real 48h remain open',inputRawSha256:proof.rawSha256,field:field.length,executions,turns:result.summary.turns,orders:result.summary.actions,seconds:result.summary.elapsedSeconds,deaths:expected.deaths,survivors:expected.survivors,commander:'cordoba',emptyGuns:3,clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,officialSave:true}));
});
