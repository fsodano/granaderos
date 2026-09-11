import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {serializeCampaign,restoreCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {MAX_SAVE_BYTES,saveByteLength,assertSaveSize} from '../game/save-limits.js';
import {launchEnemyGroup,recordEnemyGroupResult} from '../game/enemy-groups.js';
import {createBattle} from '../game/tactical.js';

// A bounded long-history fixture. Each group and stored casualty remains below
// the existing group/unit limits; no limit is enlarged to make the fixture fit.
function longCampaign(){
  const state=initialCampaign();state.hour=6500;
  const bodies=[];
  for(let i=0;i<35;i++){
    const group=launchEnemyGroup(state,'coast','retiro',{immediate:true});group.status='engaged';
    const battle=createBattle([],{id:group.id,sector:'retiro',width:20,height:16,enemies:group.units.map(unit=>({...unit,hp:0}))});
    recordEnemyGroupResult(state,group.id,battle,'victory');
    bodies.push(...battle.units);battle.units=structuredClone(bodies);state.sectorStates.retiro=battle;
  }
  return state;
}

test('a supported long campaign above two megabytes restores through standalone and exported saves',()=>{
  const state=longCampaign(),campaignText=serializeCampaign(state),exported=encodeSave(state);
  assert.ok(saveByteLength(campaignText)>2_000_000);assert.ok(saveByteLength(exported)<MAX_SAVE_BYTES);
  assert.equal(state.enemyGroups.length,35);assert.equal(state.sectorStates.retiro.units.length,1050);
  assert.deepEqual(restoreCampaign(campaignText),state);assert.deepEqual(decodeSave(exported),{campaign:state,battle:null});
});

test('the shared size limit counts UTF-8 bytes, including accents and surrogate pairs',()=>{
  assert.equal(saveByteLength('á🧉'),6);
  const exact='é'.repeat(MAX_SAVE_BYTES/2);
  assert.equal(exact.length,2_500_000);assert.equal(saveByteLength(exact),MAX_SAVE_BYTES);assert.equal(assertSaveSize(exact),exact);
  assert.throws(()=>assertSaveSize(exact+'x'),/5 MB/);
  assert.throws(()=>decodeSave(exact+'x'),/5 MB/);assert.throws(()=>restoreCampaign(exact+'x'),/5 MB/);
});

test('encoding accepts an exact UTF-8 byte budget and rejects oversized output before export',()=>{
  const state=initialCampaign();state.sizePadding='';
  const remaining=MAX_SAVE_BYTES-saveByteLength(encodeSave(state));
  state.sizePadding='é'.repeat(Math.floor(remaining/2))+'x'.repeat(remaining%2);
  const exact=encodeSave(state);assert.equal(saveByteLength(exact),MAX_SAVE_BYTES);
  assert.equal(decodeSave(exact).campaign.sizePadding,state.sizePadding);
  state.sizePadding+='x';assert.throws(()=>encodeSave(state),/5 MB/);
  // The envelope is part of the same limit, even if the campaign alone fits.
  assert.ok(saveByteLength(serializeCampaign(state))<MAX_SAVE_BYTES);
  assert.throws(()=>encodeSave(initialCampaign(),{oversized:'a'.repeat(MAX_SAVE_BYTES)}),/5 MB/);
});
