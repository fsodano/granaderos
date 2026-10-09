import {withCarriedPonchos} from './custody-gear-fixture.mjs';
import {deliverPonchos} from './npc-gift-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,npcGiftPreview,getReachable} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {makeOutfit} from '../game/outfits.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {targetPreview,resolvedOrderType} from '../game/ja2-hud.js';
const outfit=id=>({...makeOutfit('poncho',67),instanceId:id});
const npc=b=>b.npcs.find(n=>n.id==='local-retiro');
const field=()=>createBattle([{id:'p',x:2,y:2,weapon:1805,activeSlot:'item',activeItem:'inventory:coat',inventory:{coat:outfit('gift')}}],{width:12,height:8,enemies:[],exploration:true,npcs:[{id:'local-retiro',name:'Sargento',x:3,y:2,mission:true}]});
const give=b=>actBattle(b,{type:'useItem',unitId:b.units[0].id,targetId:'local-retiro'});
const step=(c,a)=>{const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,n.lastError);return n;};
test('using a held garment gives the exact item to the NPC and preserves AP in exploration',()=>{
 const b=field(),before=structuredClone(b),u=b.units[0],n=give(b);
 assert.equal(n.lastError,null);assert.deepEqual(b,before);assert.equal(n.units[0].inventory.coat,undefined);assert.deepEqual(npc(n).questGifts,[outfit('gift')]);assert.equal(n.units[0].ap,u.ap);assert.ok(n.elapsedSeconds>b.elapsedSeconds);assert.doesNotThrow(()=>validateBattleSnapshot(n));
 const preview=targetPreview(b,u,npc(b),{mode:'move'});assert.equal(preview.valid,true);assert.equal(preview.pa,0);assert.equal(preview.actionLabel,'Entregar poncho');assert.equal(resolvedOrderType(b,u,{type:'useItem',targetId:npc(b).id}),'giveItem');
});
test('wrong, ruined, absent or already fulfilled gifts reject without spending time or losing property',()=>{
 for(const change of [b=>{b.units[0].inventory.coat.condition=0;},b=>{b.units[0].inventory.coat={count:1,weight:.1,name:'Carta'};},b=>{npc(b).questGifts=[outfit('one'),outfit('two')];},b=>{npc(b).hp=0;},b=>{npc(b).id='other';},b=>{b.mode='combat';}]){
  const b=field();change(b);const n=give(b);assert.ok(n.lastError);assert.deepEqual(n.units,b.units);assert.deepEqual(n.npcs,b.npcs);assert.equal(n.elapsedSeconds,b.elapsedSeconds);
 }
});
test('gift ownership validates quantities, recipients and duplicate identities across the whole map',()=>{
 const b=give(field());
 for(const mutate of [n=>{npc(n).questGifts[0].count=2;},n=>{npc(n).questGifts.push(outfit('two'),outfit('three'));},n=>{npc(n).id='other';},n=>{n.units[0].inventory.copy=outfit('gift');}]){const n=structuredClone(b);mutate(n);assert.throws(()=>validateBattleSnapshot(n));}
});
test('approach preview and contextual use spend real movement before handing over the garment',()=>{
 // Keep the recipient on supported, open ground rather than inside the
 // generated boundary wall at x=6,y=2.
 let b=field();npc(b).x=5;b.units[0].facing=2;const plan=npcGiftPreview(b,b.units[0],npc(b));assert.equal(plan.valid,true);assert.ok(plan.path.length);const n=give(b);assert.equal(n.lastError,null);assert.ok(n.units[0].x>2);assert.equal(npc(n).questGifts.length,1);assert.ok(n.elapsedSeconds>b.elapsedSeconds);
});
test('legacy omitted-definition ponchos retain their automatic reward and exact custody across saves and visits',()=>{
 const old=initialCampaign(8);delete old.errandDefinitions;
 let c=step(old,{type:'createOfficer',name:'Juana',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
 const stock=c.merchants.retiro.supplies.ponchos,cash=c.resources.treasury;
 c=withCarriedPonchos(c,1000,2);
 assert.equal(c.merchants.retiro.supplies.ponchos,stock);assert.equal(c.resources.treasury,cash);c=step(c,{type:'visitSector'});let pair=prepareCampaignBattle(c),b=pair.battle;c=pair.campaign;const cashBeforeGifts=c.resources.treasury;
 for(let i=0;i<2;i++){
  b=deliverPonchos(b,1);
  pair=syncBattleTime(c,b);assert.equal(pair.error,null);({campaign:c,battle:b}=decodeSave(encodeSave(pair.campaign,pair.battle)));
  if(i===0){assert.equal(c.quests['retiro-uniformes'].status,'offered');assert.equal(c.conversations['local-retiro'].giftCount,1);const denied=dispatchCampaign(c,{type:'talkNPC',npcId:'local-retiro',unitId:1000,approach:'quest',sectorState:b});assert.ok(denied.lastError);assert.equal(denied.quests['retiro-uniformes'].status,'offered');}
 }
 assert.equal(c.quests['retiro-uniformes'].status,'completed');assert.equal(c.conversations['local-retiro'].giftCount,2);assert.equal(c.merchants.retiro.supplies.ponchos,stock);assert.equal(c.resources.treasury,cashBeforeGifts);
 c=step(c,{type:'leaveSector',battleId:c.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
 c=decodeSave(encodeSave(c)).campaign;c=step(c,{type:'visitSector'});pair=prepareCampaignBattle(c);c=pair.campaign;b=pair.battle;
 assert.equal(npc(b).questGifts.length,2);assert.ok(!Object.values(b.units.find(u=>u.id==='1000').inventory).some(r=>r.kind==='outfit'));
 const again=dispatchCampaign(c,{type:'talkNPC',npcId:'local-retiro',unitId:1000,approach:'quest',sectorState:b});assert.ok(again.lastError);assert.deepEqual(again.cityLoyaltyEvents,c.cityLoyaltyEvents);
});

test('departed recipients do not replace the empty-cell movement preview',()=>{
 const b=field(),u=b.units[0],point={x:3,y:2};
 npc(b).departure={destination:'buenos_aires'};
 const empty={...b,npcs:[]},ctx={mode:'move',reachable:getReachable(b,u)},expected=targetPreview(empty,u,point,ctx);
 assert.equal(expected.valid,true);
 assert.deepEqual(targetPreview(b,u,point,ctx),expected);
 const moved=actBattle(b,{type:'move',unitId:u.id,...point});
 assert.equal(moved.lastError,null);
 assert.deepEqual([moved.units[0].x,moved.units[0].y],[point.x,point.y]);
 assert.deepEqual(moved.units[0].inventory,u.inventory);
});
