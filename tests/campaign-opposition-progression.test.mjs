import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPAIGN_SECTORS} from '../game/data.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {campaignEnemyCount} from '../game/narrative.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {enterSector} from '../game/world.js';
import {launchEnemyGroup} from '../game/enemy-groups.js';
import {encodeSave,decodeSave} from '../game/save.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null);return n;};
function front(controlled){
 const s=order(initialCampaign(8),{type:'recruitCivic',id:110,term:'week'});
 // Ownership fixtures exercise each stage without inventing a winning route.
 const sectors=['retiro',...CAMPAIGN_SECTORS.map(d=>d.id).filter(id=>!['retiro','buenos_aires'].includes(id))];
 for(const id of sectors.slice(0,controlled))s.sectors[id].owner='patriot';
 return s;
}
test('real campaign attacks increase from four to thirty defenders with controlled territory',()=>{
 const counts=[];
 for(let controlled=1;controlled<=12;controlled++){
  const s=order(front(controlled),{type:'attack',sector:'buenos_aires'});
  counts.push(s.pendingBattle.enemies.length);
  const pair=prepareCampaignBattle(s,{placement:true});assert.equal(pair.error,null);
  const enemies=pair.battle.units.filter(u=>u.side==='enemy');
  assert.equal(enemies.length,s.pendingBattle.enemies.length);
  assert.equal(new Set(enemies.map(u=>`${u.x},${u.y},${u.tacticalLevel??0}`)).size,enemies.length,'all defenders have distinct positions');
  assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)).battle,pair.battle);
 }
 assert.equal(counts[0],4);assert.equal(counts.at(-1),30);
 assert.ok(counts.every((n,i)=>!i||n>counts[i-1]));
});
test('time and squad size do not replace territorial progression; losing territory reduces new forces',()=>{
 const s=front(8),expected=campaignEnemyCount(s);
 s.hour=4000;s.squad=[];assert.equal(campaignEnemyCount(s),expected);
 s.sectors.cordoba.owner='royalist';assert.ok(campaignEnemyCount(s)<expected);
 for(const sector of Object.values(s.sectors))sector.owner='royalist';assert.equal(campaignEnemyCount(s),4);
 for(const sector of Object.values(s.sectors))sector.owner='patriot';assert.equal(campaignEnemyCount(s),30);
});
test('late northern and mountain campaign sectors deploy thirty enemies without overlapping positions',()=>{
 for(const target of ['tucuman','salta','jujuy','humahuaca','uspallata','los_patos']){
  const s=front(12),def=CAMPAIGN_SECTORS.find(d=>d.id===target),origin=def.neighbors[0];
  for(const [id,sector] of Object.entries(s.sectors))sector.owner=id===target?'royalist':'patriot';
  s.location=origin;s.squads[0].location=origin;s.operativeState[110].location=origin;
  const attacked=order(s,{type:'attack',sector:target});
  const pair=prepareCampaignBattle(attacked,{placement:true});assert.equal(pair.error,null,target);
  const enemies=pair.battle.units.filter(u=>u.side==='enemy');
  assert.equal(enemies.length,30,target);
  assert.equal(new Set(enemies.map(u=>`${u.x},${u.y},${u.tacticalLevel??0}`)).size,30,target);
  assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)).battle,pair.battle);
 }
});
test('returning to an unfinished battle retains its existing force and wounds',()=>{
 const early=order(front(1),{type:'attack',sector:'buenos_aires'});
 const previous=prepareCampaignBattle(early,{placement:false}).battle;
 const wounded=previous.units.find(u=>u.side==='enemy');wounded.hp=41;wounded.bandaged=59;
 const late=order(front(12),{type:'attack',sector:'buenos_aires'});
 const revisited=enterSector(late.pendingBattle,previous);
 assert.equal(late.pendingBattle.enemies.length,30);
 assert.equal(revisited.units.filter(u=>u.side==='enemy').length,4);
 assert.equal(revisited.units.find(u=>u.id===wounded.id).hp,41);
});
test('new incursions scale, spend finite reserves, and do not resize groups already issued',()=>{
 const s=front(1),first=launchEnemyGroup(s,'north','humahuaca',{immediate:true});
 assert.equal(first.initialStrength,4);const before=structuredClone(first);
 for(const [id,sector] of Object.entries(s.sectors))if(id!=='humahuaca')sector.owner='patriot';
 const remaining=s.enemyReserves.remaining.north;
 const next=launchEnemyGroup(s,'north','humahuaca',{immediate:true});
 assert.equal(next.initialStrength,30);assert.equal(next.units.length,30);
 assert.equal(s.enemyReserves.remaining.north,remaining-30);assert.deepEqual(first,before);
 s.enemyReserves.remaining.north=3;
 assert.equal(launchEnemyGroup(s,'north','humahuaca',{immediate:true}).initialStrength,3);
 assert.equal(launchEnemyGroup(s,'north','humahuaca',{immediate:true}),null);
});
test('attacking a recorded occupation retains its original troops instead of adding scaled defenders',()=>{
 const s=front(1),group=launchEnemyGroup(s,'coast','buenos_aires',{immediate:true});
 group.status='stationed';group.resolvedAt=s.hour;
 group.units[0].hp=48;group.units[0].bandaged=52;
 for(const [id,sector] of Object.entries(s.sectors))sector.owner=id==='buenos_aires'?'royalist':'patriot';
 const attacked=order(s,{type:'attack',sector:'buenos_aires'});
 assert.deepEqual(attacked.pendingBattle.occupationGroupIds,[group.id]);
 assert.equal(attacked.pendingBattle.enemies.length,4);
 const pair=prepareCampaignBattle(attacked,{placement:true});assert.equal(pair.error,null);
 assert.equal(pair.battle.units.filter(u=>u.side==='enemy').length,4);
 assert.equal(pair.battle.units.find(u=>u.id===group.units[0].id).hp,48);
});
