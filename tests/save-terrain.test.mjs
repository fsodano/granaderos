import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,CAMPAIGN_SECTORS} from '../game/campaign.js';
import {createBattle,endTurn} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {compactSaveTerrain} from '../game/save-terrain.js';
import {MAX_SAVE_BYTES,saveByteLength} from '../game/save-limits.js';
import {roadsideDiscoveriesFor} from '../game/roadside-discoveries.js';

function packed(pair){const value={format:'granaderos',schema:2,...structuredClone(pair)};assert.equal(compactSaveTerrain(value),true);return JSON.stringify(value);}
function deployed(){const campaign=dispatchCampaign(initialCampaign(),{type:'visitSector'});assert.equal(campaign.lastError,null);return {campaign,battle:enterSector(campaign.pendingBattle)};}

test('a campaign exceeding the old full-save budget keeps every map and the next tactical turn',()=>{
 const pair=deployed();
 for(const {id} of CAMPAIGN_SECTORS){const width=128,height=64,tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));pair.campaign.sectorStates[id]=createBattle([],{sector:id,width,height,tiles,enemies:[],errandDefinitions:pair.campaign.contentCampaign?.package.errands??pair.campaign.errandDefinitions,roadsideDiscoveryDefinitions:structuredClone(roadsideDiscoveriesFor(pair.campaign))});}
 const before=structuredClone(pair),legacy=JSON.stringify({format:'granaderos',schema:1,...pair});assert.ok(saveByteLength(legacy)>MAX_SAVE_BYTES);
 const encoded=encodeSave(pair.campaign,pair.battle);assert.ok(saveByteLength(encoded)<MAX_SAVE_BYTES/2);assert.equal(JSON.parse(encoded).schema,2);
 const restored=decodeSave(encoded);assert.deepEqual(restored,pair);assert.deepEqual(pair,before);
 assert.deepEqual(endTurn(restored.battle),endTurn(pair.battle));
});

test('legacy files, non-grid tile order and independent nested tile metadata remain intact',()=>{
 const pair=deployed();pair.battle.tiles[0].memo={marks:['retained']};pair.battle.tiles[1].memo={marks:['retained']};
 const legacy=JSON.stringify({format:'granaderos',schema:1,...pair});assert.deepEqual(decodeSave(legacy),pair);
 const restored=decodeSave(packed(pair));assert.deepEqual(restored,pair);
 restored.battle.tiles[0].memo.marks.push('changed');assert.deepEqual(restored.battle.tiles[1].memo.marks,['retained']);assert.deepEqual(pair.battle.tiles[0].memo.marks,['retained']);
 pair.battle.tiles.reverse();assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)),pair);
});

test('compact input rejects corrupt indices, dimensions, palette entries and oversized expansion',()=>{
 const pair=deployed(),base=JSON.parse(packed(pair));assert.equal(base.schema,2);
 const mutations=[v=>v.battle.tiles.indices.pop(),v=>v.battle.tiles.indices[0]=-1,v=>v.battle.tiles.indices[0]=.5,v=>v.battle.tiles.indices[0]=v.battle.tiles.palette.length,v=>v.battle.tiles.palette[0]=null,v=>v.battle.tiles.palette[0].x=0,v=>v.battle.width=129,v=>v.battle.tiles.encoding='unknown',v=>v.battle.tiles.extra=true];
 for(const mutate of mutations){const bad=structuredClone(base);mutate(bad);assert.throws(()=>decodeSave(JSON.stringify(bad)),/terreno compacto/);}
 const bomb=structuredClone(base);bomb.battle.width=128;bomb.battle.height=128;bomb.battle.tiles={encoding:'palette-v1',palette:[{type:'grass',blocked:false,cover:0,memo:'x'.repeat(2000)}],indices:Array(128*128).fill(0)};
 assert.ok(saveByteLength(JSON.stringify(bomb))<MAX_SAVE_BYTES);assert.throws(()=>decodeSave(JSON.stringify(bomb)),/20 MB/);
 const invalid=structuredClone(base);invalid.battle.tiles.palette[0].type='invalid';assert.throws(()=>decodeSave(JSON.stringify(invalid)),/terreno/);
});
