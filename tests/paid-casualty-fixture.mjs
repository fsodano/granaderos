import assert from 'node:assert/strict';
import {initialCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {fight} from './cuyo-route-driver.mjs';
import {order} from './local-contract-fixture.mjs';
let cached;
export function paidCasualty(){
 if(cached)return structuredClone(cached);
 // Author an already wounded hire without first-aid stock. Ordinary enemy
 // attacks cause the casualty; the fixture does not assign a death or outcome.
 const content=defaultContentPackage(),wounded=content.characters.find(c=>c.id==='person-110');wounded.startingCondition={hp:25,energy:100,fatigue:0,bleeding:0,bandaged:0};wounded.startingSupplies={medkits:0,rations:2,torches:2,boleadoras:0};
 let s=initialCampaign(8,content);for(const id of [110,114,136,141,120,131])s=order(s,{type:'recruitCivic',id,term:'day'});s=order(s,{type:'wait',hours:6});s=order(s,{type:'attack',sector:'buenos_aires'});const request=s.pendingBattle;assert.equal(request.squad.find(u=>u.id===110).hp,25);const {battle}=fight(request,null,{scoutCostWeight:.01,avoidCivilians:true,fallbackOrders:true});assert.equal(battle.status,'victory');const victim=battle.units.find(u=>u.id==='110'&&u.side==='player'&&u.hp===0);assert.ok(victim);const pair=syncBattleTime(s,battle);assert.equal(pair.error,null);const restored=decodeSave(encodeSave(pair.campaign,pair.battle));s=order(restored.campaign,{type:'battleResult',battleId:request.id,outcome:'victory',sectorState:restored.battle,survivors:restored.battle.units.filter(u=>u.side==='player')});
 const id=Number(victim.id);assert.equal(s.operativeState[id].alive,false);assert.equal(s.contentPresence.people[`person-${id}`].recruited,true);cached={campaign:s,id};return structuredClone(cached);
}
