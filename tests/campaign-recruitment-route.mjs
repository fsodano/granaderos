// Mirrors the live dialogue handler when a campaign-issued recruit joins the field.
import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {createBattle} from '../game/tactical.js';
import {addIssuedGriefParticipant} from '../game/companion-grief.js';
import {syncBattleTime} from '../game/time.js';
import {approachNPC} from './approach-npc.mjs';
export function meetRecruits(start,npcIds,actor=4){let c=structuredClone(start);const order=a=>{c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+c.lastError);};order({type:'visitSector'});let b=enterSector(c.pendingBattle,c.sectorStates[c.location]);
for(const npcId of npcIds){b=approachNPC(b,String(actor),npcId);let sync=syncBattleTime(c,b);assert.equal(sync.error,null);c=sync.campaign;b=sync.battle;order({type:'talkNPC',unitId:actor,npcId,approach:'recruit',sectorState:b});assert.equal(c.lastConversation.outcome,'recruited');const id=c.lastConversation.operativeId,npc=b.npcs.find(n=>n.id===npcId),record=c.pendingBattle.squad.find(o=>o.id===id);b.npcs=b.npcs.filter(n=>n.id!==npcId);if(record){const unit=createBattle([record],{width:b.width,height:b.height,enemies:[],exploration:true}).units.find(u=>u.side==='player');const deployed={...unit,x:npc.x,y:npc.y};b.units.push(deployed);addIssuedGriefParticipant(b,deployed);}}
let sync=syncBattleTime(c,b);assert.equal(sync.error,null);c=sync.campaign;b=sync.battle;order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});return c;}
