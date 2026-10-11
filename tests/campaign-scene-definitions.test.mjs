import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCampaignSceneDefinitions} from '../game/campaign-scene-definitions.js';

test('legacy scene validation preserves its exact save shape',()=>{
 const scene={sectorId:'retiro',units:[],npcs:[]},before=structuredClone(scene);
 validateCampaignSceneDefinitions({},scene);
 assert.deepEqual(scene,before);
});

test('a pinned world restores only its own locality list',()=>{
 const campaign={contentCampaign:{package:{world:{sectors:[{id:'harbour'},{id:'highland'}]}}}},scene={sectorId:'harbour'};
 validateCampaignSceneDefinitions(campaign,scene);
 assert.deepEqual(scene.localityIds,['harbour','highland']);
 assert.doesNotThrow(()=>validateCampaignSceneDefinitions(campaign,scene));
});

test('a forged tactical locality list is rejected without replacement',()=>{
 for(const campaign of [{},{contentCampaign:{package:{world:{sectors:[{id:'harbour'}]}}}}]){
  const scene={localityIds:['foreign-city']},before=structuredClone(scene);
  assert.throws(()=>validateCampaignSceneDefinitions(campaign,scene),/localidades/);
  assert.deepEqual(scene,before);
 }
});
