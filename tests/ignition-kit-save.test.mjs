import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {encodeSave,decodeSave} from '../game/save.js';

test('campaign restore keeps named inventory objects and pinned content while removing obsolete ignition stock',()=>{
 const content=defaultContentPackage(),s=initialCampaign(43,content),u=s.operativeState[110];
 u.inventory={priming:{name:'Carta',count:1,weight:0},flints:{name:'Estuche',count:1,weight:.1}};
 u.priming=8;u.flints=2;
 const contents=JSON.stringify(s.contentCampaign),inventory=structuredClone(u.inventory),resources=structuredClone(s.resources);
 const first=decodeSave(encodeSave(s)).campaign,second=decodeSave(encodeSave(first)).campaign;
 assert.deepEqual(second.operativeState[110].inventory,inventory);assert.equal(second.operativeState[110].priming,undefined);assert.equal(second.operativeState[110].flints,undefined);
 assert.equal(JSON.stringify(second.contentCampaign),contents);assert.deepEqual(second.resources,resources);assert.deepEqual(second,first);assert.deepEqual(u.inventory,inventory);assert.equal(u.priming,8);
});
