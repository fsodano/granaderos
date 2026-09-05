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
