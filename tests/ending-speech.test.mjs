import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {speechFor} from '../game/characters.js';
import {OPERATIVES} from '../game/data.js';import {CIVIC_RECRUITS,defaultProfile,createOfficerRecord} from '../game/recruitment.js';
test('all historical, hired and custom characters have seven nonempty speech events',()=>{
 const custom=createOfficerRecord('Ana del Sur',{origin:'cabildo',doctrine:'line_marksman',crisis:'rescue',specialty:'night',temperament:'steady'},defaultProfile());
 for(const op of [...OPERATIVES,...CIVIC_RECRUITS,custom])for(const event of ['hired','contact','cleared','wounded','exhausted','death','ending'])assert.ok(speechFor(op,event)?.length>10,`${op.name} ${event}`);
});
test('completion emits each living companion ending once and never repeats on later orders',()=>{
 const s=initialCampaign();s.phase=4;s.recruited=[57,3,4];s.squad=[57,3];s.squads[0].members=[57,3];s.operativeState[4].alive=false;s.operativeState[4].hp=0;s.flags.commission=true;
 for(const sector of Object.values(s.sectors))sector.owner='patriot';
 let n=dispatchCampaign(s,{type:'wait',hours:1});assert.equal(n.lastError,null);assert.equal(n.completed,true);
 const living=rosterFor(n).filter(o=>[57,3].includes(o.id));for(const op of living)assert.equal(n.log.filter(l=>l.text.includes(speechFor(op,'ending'))).length,1);
 const dead=rosterFor(n).find(o=>o.id===4);assert.equal(n.log.filter(l=>l.text.includes(speechFor(dead,'ending'))).length,0);
 n=dispatchCampaign(n,{type:'wait',hours:1});assert.equal(n.lastError,null);for(const op of living)assert.equal(n.log.filter(l=>l.text.includes(speechFor(op,'ending'))).length,1);
});

// End-state fixtures isolate completion rules; they do not prove conquest.
function preparedEnding(){
 const s=initialCampaign();s.phase=4;s.recruited=[57,2];s.squad=[2];s.squads[0].members=[2];
 for(const region of Object.values(s.sectors))region.owner='patriot';
 return s;
}
test('a recruited commander who died cannot trigger the campaign ending',()=>{
 const s=preparedEnding();s.operativeState[57].hp=0;s.operativeState[57].alive=false;
 const n=dispatchCampaign(s,{type:'wait',hours:1});assert.equal(n.lastError,null);
 assert.equal(n.completed,false);assert.equal(n.defeated,true);
 assert.ok(n.log.some(row=>row.text.includes('San Martín ha caído')));
 assert.equal(n.log.some(row=>row.text.includes('Campaña concluida')),false);
 const again=dispatchCampaign(n,{type:'wait',hours:1});assert.ok(again.lastError);
 assert.equal(again.hour,n.hour);assert.deepEqual(again.log,n.log);
});
test('a living wounded commander can finish the campaign without free healing',()=>{
 const s=preparedEnding();s.operativeState[57].hp=25;s.operativeState[57].bandaged=s.operativeState[57].maxHp-25;
 const n=dispatchCampaign(s,{type:'wait',hours:1});assert.equal(n.lastError,null);
 assert.equal(n.completed,true);assert.equal(n.defeated,false);assert.equal(n.operativeState[57].hp,25);
});
