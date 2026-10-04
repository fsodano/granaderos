import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dailyIncome} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {defaultProfile} from '../game/character-profile.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn} from '../game/tactical.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {fight} from './cuyo-route-driver.mjs';
import {approachNPC} from './approach-npc.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {order,visit,leave,saved,sync} from './local-contract-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
function tactical(pair,action){
 const battle=action.type==='endTurn'?endTurn(pair.battle):actBattle(pair.battle,action);
 assert.equal(battle.lastError,null,battle.lastError);return sync({campaign:pair.campaign,battle});
}

test('the ordinary 3200-peso opening conquers Buenos Aires with finite equipment and earns its first port payment through a physical meeting',()=>{
 let state=initialCampaign(8,defaultContentPackage());assert.equal(state.resources.treasury,3200);
 const profile={...defaultProfile(),classId:'soldado',attributes:{maxHp:85,agility:75,dexterity:75,strength:55,leadership:35,wisdom:35,marksmanship:85,mechanical:35,explosives:35,medical:35}};
 state=order(state,{type:'createOfficer',name:'Isabel del Norte',profile,answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally',specialty:'teacher',temperament:'steady'}});
 for(const id of [123,115,114,131,120])state=order(state,{type:'recruitCivic',id,term:'day'});
 state=advanceCampaignHours(state,6);assert.equal(state.squad.length,6);assert.ok(state.resources.treasury>0);
 let p=takeFiniteCache(visit(state),120,[{weapon:1801,count:1},{ammoType:'musket_75',count:12}]);
 const actor=p.battle.units.find(u=>u.id==='120'),key=Object.keys(actor.inventory).find(k=>actor.inventory[k].weapon===1801);assert.ok(key);
 p=tactical(p,{type:'equipLoot',unitId:'120',inventoryKey:key});p=tactical(p,{type:'reload',unitId:'120'});state=leaveFiniteCache(p);
 state=order(state,{type:'attack',sector:'buenos_aires'});const request=structuredClone(state.pendingBattle),result=fight(request,null,{scoutCostWeight:.01,avoidCivilians:true,fallbackOrders:true});
 assert.equal(result.battle.status,'victory',JSON.stringify(result.battle.units.map(({id,hp,side})=>({id,hp,side}))));
 p={campaign:state,battle:enterSector(request)};
 for(const [index,action]of result.orders.entries()){p=tactical(p,action);if(index===Math.floor(result.orders.length/2))p=saved(p);}
 assert.deepEqual(p.battle.units,result.battle.units);assert.equal(p.battle.seed,result.battle.seed);
 p=tactical(saved(p),{type:'explore'});const aid=autoBandageBattle(p.battle);for(const action of aid.steps)p=tactical(p,action);
 state=order(p.campaign,{type:'battleResult',battleId:request.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});
 assert.equal(state.sectors.buenos_aires.owner,'patriot');assert.equal(state.sectors.retiro.owner,'patriot');assert.equal(dailyIncome(state),0);assert.equal(state.townIncome.activations.buenos_aires,undefined);
 p=visit(saved({campaign:state}).campaign);const npc=p.battle.npcs.find(n=>n.id==='local-buenos_aires'),speaker=p.battle.units.find(u=>u.side==='player'&&u.hp>=15&&!u.unconscious&&!u.routed);assert.ok(npc);assert.ok(speaker);
 p=sync({campaign:p.campaign,battle:approachNPC(p.battle,speaker.id,npc.id)});
 state=order(p.campaign,{type:'talkNPC',npcId:npc.id,unitId:Number(speaker.id),approach:'direct',sectorState:p.battle});assert.equal(state.lastConversation.outcome,'incomeActivated');assert.equal(dailyIncome(state),8000);
 state=saved({campaign:leave(saved({campaign:state,battle:p.battle}))}).campaign;
 const money=state.resources.treasury,remaining=24-state.hour%24;
 state=advanceCampaignHours(state,remaining);assert.equal(state.resources.treasury,money+8000);assert.ok(state.townIncome.activations.buenos_aires);assert.equal(state.townIncome.lastPaidDay,Math.floor(state.hour/24));
 const restored=saved({campaign:state}).campaign;assert.deepEqual(restored,state);state=advanceCampaignHours(restored,1);assert.equal(state.resources.treasury,money+8000);
});
