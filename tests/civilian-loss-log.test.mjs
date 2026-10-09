import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {createBattle,actBattle,getReachable} from '../game/tactical.js';
import {sanLorenzoAlly} from '../game/missions.js';
import {enterSector} from '../game/world.js';
import {civilianIncidents} from '../game/civilian-harm.js';
import {order,saved,sync,leave} from './local-contract-fixture.mjs';
import {completeTestTravel} from './campaign-test-helpers.mjs';

test('an essential resident death remains loadable when the campaign diary is already full',()=>{
 let s=order(initialCampaign(8),{type:'recruitCivic',id:110,term:'month'});
 // Prepared northern chapter and filled diary isolate the save boundary.
 // Recruitment, approach, fatal wounds, clock and settlement use actual orders.
 s.phase=2;s.flags.sanLorenzo=true;s.flags.northPact=true;
 s.missionAllies.san_lorenzo=createBattle([sanLorenzoAlly(s)],{width:8,height:8,enemies:[],exploration:true}).units[0];
 for(const id of ['buenos_aires','cordoba','tucuman','salta'])s.sectors[id].owner='patriot';
 s=completeTestTravel(order(s,{type:'travel',sector:'tucuman'}),{sector:'tucuman'});s=order(s,{type:'visitMission',mission:'yatasto'});
 let p={campaign:s,battle:enterSector({...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0})};
 const target=()=>p.battle.npcs.find(n=>n.id==='yatasto-san-martin');
 const spot=getReachable(p.battle,'110').find(t=>Math.abs(t.x-target().x)+Math.abs(t.y-target().y)===1);assert.ok(spot);
 const act=a=>{const b=actBattle(p.battle,{unitId:'110',...a});assert.equal(b.lastError,null);p=sync({campaign:p.campaign,battle:b});};
 if(spot.cost)act({type:'move',x:spot.x,y:spot.y});
 p.campaign.log=Array.from({length:80},(_,i)=>({hour:p.campaign.hour,text:`Entrada previa ${i}`}));
 p=saved(p);while(target().hp>0)act({type:'melee',targetId:target().id});
 assert.equal(p.campaign.defeated,true);assert.equal(p.campaign.completed,false);assert.ok(civilianIncidents(target()).some(e=>e.kind==='death'));
 assert.equal(p.campaign.log.length,80);assert.match(p.campaign.log[0].text,/San Martín ha muerto/);assert.ok(!p.campaign.log.some(e=>e.text==='Entrada previa 79'));
 const loaded=saved(p);assert.equal(loaded.battle.npcs.find(n=>n.id==='yatasto-san-martin').hp,0);assert.deepEqual(loaded.campaign.log,p.campaign.log);
 const again=sync(loaded);assert.deepEqual(again.campaign.log,loaded.campaign.log,'the acknowledged death cannot duplicate its diary entry');
 const ended=saved({campaign:leave(again)}).campaign;assert.equal(ended.defeated,true);assert.equal(ended.operativeState[57].alive,false);assert.equal(ended.log.filter(e=>/San Martín ha muerto/.test(e.text)).length,1);assert.ok(dispatchCampaign(ended,{type:'wait',hours:1}).lastError);
});
