import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {defaultProfile} from '../game/recruitment.js';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
test('custom level growth preserves allocation and applies earned practice once across save and entry',()=>{
 const profile=defaultProfile();profile.attributes.marksmanship=75;profile.attributes.mechanical=35;
 let s=order(initialCampaign(7),{type:'createOfficer',name:'Ana del Monte',profile,answers:{origin:'estancia',doctrine:'line_marksman',crisis:'rally',specialty:'night',temperament:'optimistic'}});
 // Saved veteran fixture immediately below the next level and practice threshold.
 s.operativeState[1000].xp=95;s.operativeState[1000].skillPractice={mechanical:39};s.operativeState[1000].condition=50;
 s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});
 let b=enterSector(s.pendingBattle);b=actBattle(b,{type:'repair',unitId:1000});assert.equal(b.lastError,null);assert.equal(b.units[0].trainedStats.mechanical,1);
 s=order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'retreat',survivors:b.units.filter(u=>u.side==='player'),sectorState:b});
 const op=rosterFor(s).find(o=>o.id===1000);assert.equal(op.level,2);assert.equal(op.xp,105);assert.equal(op.marksmanship,79);assert.equal(op.mechanical,38);assert.equal(op.maxHp,57);assert.equal(op.personality,'optimistic');assert.equal(op.portraitId,profile.portraitId);assert.deepEqual(s.officer.profile.attributes,profile.attributes);
 s=restoreCampaign(serializeCampaign(s));s=order(s,{type:'visitSector'});const reentered=enterSector(s.pendingBattle).units.find(u=>u.id==='1000');assert.equal(reentered.mechanical,38);assert.equal(reentered.marksmanship,79);assert.equal(reentered.personality,'optimistic');assert.equal(reentered.portraitId,profile.portraitId);assert.ok(reentered.traits.includes('night_vision'));
});
