import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';
import {saved} from './local-contract-fixture.mjs';
import {freshMendozaLoss} from './historical-loss-fixture.mjs';

test('a fresh Mendoza tactical victory becomes a saved campaign defeat when its required engineer dies',()=>{
 const {campaign:s,deathCheckpoint:p}=freshMendozaLoss();
 assert.equal(p.campaign.defeated,true);assert.equal(p.campaign.completed,false);assert.ok(p.campaign.pendingBattle);assert.equal(s.defeated,true);assert.equal(s.completed,false);assert.equal(s.pendingBattle,null);assert.equal(s.sectors.mendoza.owner,'patriot');assert.equal(s.flags.foundry,false);assert.equal(s.operativeState[2].hp,0);
 assert.equal(saved({campaign:s}).campaign.defeated,true);assert.ok(dispatchCampaign(s,{type:'foundry'}).lastError);assert.ok(dispatchCampaign(s,{type:'wait',hours:1}).lastError);assert.ok(s.log.some(e=>/Beltrán ha muerto/.test(e.text)));
});

test('a serving assigned engineer death fails the original campaign at the active checkpoint and rejects a revived active save',async()=>{
 const {servingEngineerLoss}=await import('./historical-loss-fixture.mjs');const {encodeSave,decodeSave}=await import('../game/save.js');const {campaignRole}=await import('../game/campaign-roles.js');
 const {campaign:s,active:p}=await servingEngineerLoss();assert.equal(p.campaign.defeated,true);assert.equal(p.campaign.operativeState[110].alive,false);assert.equal(s.defeated,true);assert.equal(s.operativeState[2].alive,true);assert.ok(s.log.some(e=>e.text.startsWith(campaignRole(s,'foundryEngineer').name+' ha muerto')));
 const bad=JSON.parse(encodeSave(p.campaign,p.battle));bad.battle.units.find(u=>u.id==='110').hp=1;assert.throws(()=>decodeSave(JSON.stringify(bad)));
 // Reproduce the previous format's nonterminal flag without changing its real casualty.
 const old=JSON.parse(encodeSave(s));old.campaign.defeated=false;old.campaign.log=old.campaign.log.filter(e=>!e.text.includes('responsable de fundición'));
 const restored=decodeSave(JSON.stringify(old)).campaign;assert.equal(restored.defeated,true);assert.equal(restored.operativeState[110].hp,0);assert.equal(restored.resources.treasury,s.resources.treasury);const next=saved({campaign:restored}).campaign;assert.deepEqual(next.log,restored.log);
});

test('an actual completed foundry or authored progression permits continued play after its engineer dies',async()=>{
 const {servingEngineerLoss}=await import('./historical-loss-fixture.mjs');
 for(const options of [{built:true},{custom:true}]){
  const {campaign:s,active:p}=await servingEngineerLoss(options);assert.equal(p.campaign.defeated,false);assert.equal(s.operativeState[110].alive,false);assert.equal(s.defeated,false);assert.equal(s.completed,false);const next=dispatchCampaign(s,{type:'wait',hours:1});assert.equal(next.lastError,null);assert.equal(saved({campaign:next}).campaign.defeated,false);
  if(options.built){const funded=dispatchCampaign(s,{type:'fundArmy'});assert.equal(funded.lastError,null);assert.equal(funded.flags.armyFunded,true);assert.equal(funded.resources.treasury,s.resources.treasury-809);}
 }
});

test('a recruited historical commander killed by an enemy ends the campaign before field-result settlement',async()=>{
 const {initialCampaign}=await import('../game/campaign.js');const {createBattle,endTurn}=await import('../game/tactical.js');const {secureArea}=await import('./controlled-area-fixture.mjs');const {order,sync}=await import('./local-contract-fixture.mjs');
 // Prepared late service, territory and prior injury isolate a recruited commander.
 // The fatal shot, active save and final report still pass through real commands.
 let s=order(secureArea(initialCampaign(8),'buenos_aires'),{type:'createOfficer',name:'Isabel',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});
 s.phase=4;s.flags.foundry=true;s.recruited.push(57);s.squad.push(57);s.squads[0].members=[...s.squad];s.operativeState[57].hp=30;s.operativeState[57].location=s.location;s.contracts[57]={kind:'patriot',term:'month',started:s.hour,expiresAt:null,paid:0};
 s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});const r=s.pendingBattle;
 let battle=createBattle(r.squad.map(u=>({...u,x:1,y:u.id===57?1:6})),{width:12,height:8,id:r.id,sector:r.sector,npcs:r.npcs,seed:45,hour:s.hour,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[{id:'guard',x:7,y:1,weapon:1802,ammo:0,fatigue:100,marksmanship:100}]});battle=endTurn(battle);assert.equal(battle.units.find(u=>u.id==='57').hp,0);
 const p=saved(sync({campaign:s,battle}));assert.equal(p.campaign.defeated,true);assert.equal(p.campaign.completed,false);assert.equal(p.campaign.operativeState[57].alive,false);
 s=saved({campaign:order(p.campaign,{type:'battleResult',battleId:r.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')})}).campaign;assert.equal(s.defeated,true);assert.equal(s.completed,false);assert.match(s.log.find(e=>/ha muerto/.test(e.text)).text,/San Martín/);
});
