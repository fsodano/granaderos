import test from 'node:test';import assert from 'node:assert/strict';
import {enterSector} from '../game/world.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';import {initialCampaign,dispatchCampaign} from '../game/campaign.js';import {encodeSave,decodeSave} from '../game/save.js';
test('the first published campaign battle synchronizes immediate enemy initiative and can be saved before any input',()=>{
 const step=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};let c=step(initialCampaign(8),{type:'createOfficer',name:'Vigía del Norte',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});c=step(c,{type:'travel',sector:'buenos_aires'});c=step(c,{type:'wait',hours:12});c=step(c,{type:'attack',sector:'san_nicolas'});
 const r=c.pendingBattle;for(const enemy of r.enemies)Object.assign(enemy,{facing:6,marksmanship:0,patrol:false,overwatch:false});
 const source=enterSector(r),enemy=source.units.find(u=>u.side==='enemy');
 source.tiles=source.tiles.map(t=>({x:t.x,y:t.y,type:'grass',blocked:false,cover:0}));source.props=[];source.buildings=[];source.npcs=[];
 Object.assign(source.units[0],{x:enemy.x-6,y:enemy.y,facing:6});source.savedHour=c.hour;source.savedSecond=c.secondOfHour;c.sectorStates[r.sector]=source;
 // An exploration deployment can still meet an observing hostile on arrival.
 r.exploration=true;
 delete r.squad[0].entryEdge;delete r.squad[0].entryAnchor;r.squad[0].entryReason='resident';r.squad[0].facing=6;
 const pair=prepareCampaignBattle(c);assert.equal(pair.error,null);assert.equal(pair.battle.roundFirstSide,'enemy');assert.equal(pair.battle.elapsedSeconds,6);assert.equal(pair.battle.syncedSeconds,6);assert.equal(pair.campaign.pendingBattle.syncedSeconds,6);assert.equal(pair.campaign.secondOfHour,6);const saved=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(saved.battle,pair.battle);
 const resume={...pair.campaign,pendingBattle:{...pair.campaign.pendingBattle,resumeSnapshot:pair.battle}};const again=prepareCampaignBattle(resume);assert.equal(again.error,null);assert.equal(again.campaign.secondOfHour,6);assert.deepEqual(again.battle,pair.battle);
});


test('a peaceful opening publishes a loadable pair without advancing time or mutating its source',()=>{
 let c=dispatchCampaign(initialCampaign(8),{type:'createOfficer',name:'Vigía',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});c=dispatchCampaign(c,{type:'visitSector'});assert.equal(c.lastError,null);const before=structuredClone(c),pair=prepareCampaignBattle(c);
 assert.equal(pair.error,null);assert.equal(pair.battle.mode,'exploration');assert.equal(pair.battle.elapsedSeconds,0);assert.equal(pair.campaign.hour,c.hour);assert.equal(pair.campaign.secondOfHour,c.secondOfHour??0);assert.deepEqual(c,before);assert.deepEqual(decodeSave(encodeSave(pair.campaign,pair.battle)).battle,pair.battle);
});
test('opening without a pending deployment returns an error and preserves the campaign',()=>{
 const c=initialCampaign(8),before=structuredClone(c),pair=prepareCampaignBattle(c);assert.ok(pair.error);assert.equal(pair.battle,null);assert.equal(pair.campaign,c);assert.deepEqual(c,before);
});
