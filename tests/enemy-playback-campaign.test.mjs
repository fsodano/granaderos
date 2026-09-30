import {mountCampaign} from './mounted-live-campaign-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {act} from '../web/node_modules/react/index.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {createBattle,endTurn} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {withCharacterSpeech} from '../game/character-events.js';
import {encodeSave,decodeSave} from '../game/save.js';

test('the actual page prevents competing orders and saves only the completed enemy sequence',async t=>{
 let campaign=dispatchCampaign(initialCampaign(),{type:'travel',sector:'buenos_aires'});
 campaign=dispatchCampaign(campaign,{type:'attack',sector:'san_nicolas'});assert.equal(campaign.lastError,null);
 const request=campaign.pendingBattle,battle=createBattle(request.squad.map((u,i)=>({...u,x:1,y:1+i})),{...request,width:12,height:8,hour:campaign.hour,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:7,y:1,weapon:1809}]});
 for(const unit of battle.units.filter(u=>u.side==='player'))unit.ap=0;
 const pair=syncBattleTime(campaign,battle);assert.equal(pair.error,null);
 const before=decodeSave(encodeSave(pair.campaign,pair.battle)),m=await mountCampaign(t,before),unitId=before.battle.units[0].id;
 const finalBattle=withCharacterSpeech(before.battle,endTurn(before.battle)),want=syncBattleTime(before.campaign,finalBattle);assert.equal(want.error,null);
 await act(async()=>{
  m.document.body.dispatchEvent(new m.dom.window.KeyboardEvent('keydown',{key:'d',bubbles:true}));
  assert.throws(()=>m.issue({type:'movement',unitId,movement:'crouch'}),/termine el movimiento/);
  assert.deepEqual(m.saved(),before);
 });
 const deadline=Date.now()+10000;let observed=false;
 while(Date.now()<deadline){
  await act(async()=>new Promise(resolve=>setTimeout(resolve,25)));
  if(m.document.querySelector('[data-enemy-frame]')){observed=true;assert.deepEqual(m.saved(),before);}
  else if(m.saved().battle.turn!==before.battle.turn)break;
 }
 assert.ok(observed,'the real page displayed intermediate frames');
 assert.deepEqual(m.saved(),{campaign:want.campaign,battle:want.battle});
 const available=want.battle.units.find(unit=>unit.side==='player'&&unit.hp>0&&!unit.unconscious);assert.ok(available);
 await act(async()=>assert.doesNotThrow(()=>m.issue({type:'movement',unitId:available.id,movement:'crouch'})));
});
