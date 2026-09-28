import assert from 'node:assert/strict';
import {initialCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {fight} from './coastal-route-driver.mjs';
import {order} from './local-contract-fixture.mjs';
let cached;
export function paidCasualty(){
 if(cached)return structuredClone(cached);
 let s=initialCampaign(8,defaultContentPackage());for(const id of [128,142,123,115,131,110])s=order(s,{type:'recruitCivic',id,term:'day'});s=order(s,{type:'wait',hours:6});s=order(s,{type:'attack',sector:'buenos_aires'});const request=s.pendingBattle,{battle}=fight(request);assert.equal(battle.status,'victory');const victim=battle.units.find(u=>u.side==='player'&&u.hp===0);assert.ok(victim);const pair=syncBattleTime(s,battle);assert.equal(pair.error,null);const restored=decodeSave(encodeSave(pair.campaign,pair.battle));s=order(restored.campaign,{type:'battleResult',battleId:request.id,outcome:'victory',sectorState:restored.battle,survivors:restored.battle.units.filter(u=>u.side==='player')});
 const id=Number(victim.id);assert.equal(s.operativeState[id].alive,false);assert.equal(s.contentPresence.people[`person-${id}`].recruited,true);cached={campaign:s,id};return structuredClone(cached);
}
