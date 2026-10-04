import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {scriptedWithdrawal} from './scripted-battle-report.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {rolesForContent,campaignRole,campaignRoleActive,foundryReason} from '../game/campaign-roles.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {order,saved,A} from './local-contract-fixture.mjs';
import {rolePackage} from './campaign-roles-fixture.mjs';
const ids=d=>({front:operativeIdForCharacter(d,'vanguard'),engineer:operativeIdForCharacter(d,'engineer')});
function hired(d=rolePackage(),term='week'){
 const {front,engineer}=ids(d);let s=order(initialCampaign(42,d),{type:'recruitCivic',id:front,term:'week'});s=order(s,{type:'recruitCivic',id:engineer,term});return {s,front,engineer};
}

test('campaign role references validate existing identities, explicit disabling and older-package defaults',()=>{
 assert.deepEqual(rolesForContent(),{foundryEngineer:'person-2',marchCommander:'person-57'});assert.equal(campaignRole(initialCampaign(),'foundryEngineer').id,2);assert.deepEqual(rolesForContent(defaultContentPackage()),rolesForContent());
 for(const campaignRoles of [null,[],{},false,{foundryEngineer:'engineer'}, {foundryEngineer:'missing',marchCommander:null},{foundryEngineer:2,marchCommander:null},{foundryEngineer:null,marchCommander:null,extra:null}]){const d=rolePackage();d.campaignRoles=campaignRoles;assert.ok(validateContentPackage(d).length);assert.throws(()=>initialCampaign(42,d),/Funciones de campaña/);}
 const d=rolePackage();delete d.campaignRoles;assert.deepEqual(rolesForContent(d),{foundryEngineer:null,marchCommander:null});assert.equal(campaignRole(initialCampaign(42,d),'foundryEngineer'),null);d.campaignRoles={foundryEngineer:null,marchCommander:null};assert.deepEqual(validateContentPackage(d),[]);assert.ok(saved({campaign:initialCampaign(42,d)}));
});

test('a real paid arrival activates the assigned workshop and marching benefit without historical identities',()=>{
 let {s,front,engineer}=hired();const paid=s.resources.treasury;assert.equal(campaignRoleActive(s,'foundryEngineer'),false);assert.match(foundryReason(s),/Elena/);let denied=dispatchCampaign(s,{type:'foundry'});assert.match(denied.lastError,/Elena/);assert.equal(denied.resources.treasury,paid);
 s=order(s,{type:'travel',sector:A});assert.equal(s.operativeState[front].fatigue,8);s=order(s,{type:'travel',sector:'retiro'});assert.equal(s.hour,6);s=order(saved({campaign:s}).campaign,{type:'wait',hours:2});assert.equal(campaignRoleActive(s,'foundryEngineer'),true);assert.equal(campaignRoleActive(s,'marchCommander'),true);assert.equal(s.resources.treasury,paid);assert.equal(s.operativeState[front].ammo+s.operativeState[front].carriedLoaded,10);assert.equal(s.recruited.includes(engineer),true);s=order(s,{type:'assignToSquad',operativeId:engineer,squadId:s.activeSquadId});assert.deepEqual(s.squad,[front,engineer]);
 const before=s.operativeState[front].fatigue;s=order(s,{type:'travel',sector:A});assert.equal(s.operativeState[front].fatigue,before);assert.equal(s.operativeState[engineer].fatigue,0);s=order(s,{type:'travel',sector:'retiro'});s=order(s,{type:'foundry'});assert.equal(s.resources.treasury,paid-500);assert.equal(s.operativeState[engineer].ammo+s.operativeState[engineer].carriedLoaded,10);assert.equal(s.flags.foundry,true);assert.match(s.log[0].text,/Elena organiza El Plumerillo/);denied=dispatchCampaign(s,{type:'foundry'});assert.ok(denied.lastError);assert.equal(denied.resources.treasury,s.resources.treasury);assert.equal(s.operativeState[2],undefined);assert.equal(s.operativeState[57],undefined);
 s=order(s,{type:'fundArmy'});assert.equal(s.resources.treasury,paid-3500);assert.equal(saved({campaign:s}).campaign.flags.armyFunded,true);
});

test('actual contract expiry removes both role privileges, including when it occurs during a locality march',()=>{
 let {s,front,engineer}=hired(rolePackage(),'day');s=order(s,{type:'wait',hours:6});assert.equal(s.contracts[engineer].expiresAt,30);s=order(s,{type:'wait',hours:22});s=order(s,{type:'travel',sector:'buenos_aires'});assert.equal(s.hour,40);assert.equal(s.recruited.includes(engineer),false);assert.equal(s.operativeState[engineer].location,'buenos_aires');assert.equal(campaignRoleActive(s,'marchCommander'),false);assert.equal(s.operativeState[front].fatigue,22);assert.equal(foundryReason(s).includes('Elena'),true);const denied=dispatchCampaign(s,{type:'foundry'});assert.ok(denied.lastError);assert.equal(denied.flags.foundry,false);assert.ok(saved({campaign:s}));
 // A completed, paid workshop persists after its organizer finishes the contract.
 let p=hired(rolePackage(),'day');p.s=order(p.s,{type:'wait',hours:6});p.s=order(p.s,{type:'foundry'});p.s=advanceCampaignHours(p.s,24);assert.equal(campaignRoleActive(p.s,'foundryEngineer'),false);p.s=order(p.s,{type:'fundArmy'});assert.equal(saved({campaign:p.s}).campaign.flags.armyFunded,true);
});

test('disabled roles grant no benefit, and prepared custody, death and occupation states block uncompleted services',()=>{
 const d=rolePackage();d.campaignRoles={foundryEngineer:null,marchCommander:null};let {s,front}=hired(d);s=order(s,{type:'wait',hours:6});assert.match(dispatchCampaign(s,{type:'foundry'}).lastError,/no tiene responsable/);s=order(s,{type:'travel',sector:'buenos_aires'});assert.equal(s.operativeState[front].fatigue,24);
 const ready=hired();ready.s=order(ready.s,{type:'wait',hours:6});for(const mutate of [s=>{s.operativeState[ready.engineer].captured=true;},s=>{s.operativeState[ready.engineer].alive=false;s.operativeState[ready.engineer].hp=0;},s=>{s.contracts[ready.engineer].departurePending=true;}]){const fixture=structuredClone(ready.s);mutate(fixture);assert.equal(campaignRoleActive(fixture,'marchCommander'),false);const n=dispatchCampaign(fixture,{type:'foundry'});assert.ok(n.lastError);assert.equal(n.resources.treasury,fixture.resources.treasury);}
 const occupied=structuredClone(ready.s);occupied.sectors.mendoza.owner='royalist';assert.match(dispatchCampaign(occupied,{type:'foundry'}).lastError,/Mendoza/);
});

test('role settings remain pinned through saves and external draft changes',()=>{
 const d=rolePackage(),s=initialCampaign(42,d);d.campaignRoles.marchCommander=null;assert.equal(saved({campaign:s}).campaign.contentCampaign.package.campaignRoles.marchCommander,'engineer');const bad=JSON.parse(encodeSave(s));bad.campaign.contentCampaign.package.campaignRoles.marchCommander=null;assert.throws(()=>decodeSave(JSON.stringify(bad)),/identidad/);
});

test('an actual tactical death removes the assigned role after saved battle settlement without ending a custom campaign',async()=>{
 const {createBattle,endTurn}=await import('../game/tactical.js');const {sync}=await import('./local-contract-fixture.mjs');const d=rolePackage();d.characters.find(c=>c.id==='engineer').attributes.maxHp=30;let {s,engineer,front}=hired(d);s=order(s,{type:'wait',hours:6});s=order(s,{type:'travel',sector:'buenos_aires'});assert.equal(s.operativeState[front].fatigue,0);s=order(s,{type:'attack',sector:'san_nicolas'});const r=s.pendingBattle;
 // Prepared final opponent and casualties isolate role loss; the guard must cause the fatal wound.
 let battle=createBattle(r.squad.map(u=>({...u,x:u.id===engineer?5:1,y:u.id===engineer?1:6})),{...r,width:12,height:8,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:Math.floor(i/12)===4?'wall':'grass',blocked:Math.floor(i/12)===4,blocksSight:Math.floor(i/12)===4,cover:0})),enemies:r.enemies.map((u,i)=>({...u,x:7,y:i%8,...(i?{hp:0,bleeding:0,bandaged:0}:{y:1,marksmanship:100})}))});battle=endTurn(battle);assert.equal(battle.units.find(u=>u.id===String(engineer)).hp,0);battle=scriptedWithdrawal(battle);const p=saved(sync({campaign:s,battle}));s=order(p.campaign,{type:'battleResult',battleId:r.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});s=saved({campaign:s}).campaign;assert.equal(s.operativeState[engineer].alive,false);assert.equal(s.recruited.includes(engineer),true);assert.equal(s.defeated,false);assert.equal(campaignRoleActive(s,'marchCommander'),false);assert.ok(dispatchCampaign(s,{type:'foundry'}).lastError);s=order(s,{type:'travel',sector:'retiro'});assert.ok(s.operativeState[front].fatigue>0);assert.ok(saved({campaign:s}));
});


test('a serving remote march commander benefits a separately queued squad without moving the commander',()=>{
 let {s,front,engineer}=hired();s=advanceCampaignHours(s,6);s=order(s,{type:'createSquad',ids:[front],name:'Columna adelantada'});const origin=s.operativeState[engineer].location;
 s=order(s,{type:'travel',sector:'buenos_aires',queue:true});s=advanceCampaignHours(s,12);assert.equal(s.location,'buenos_aires');assert.equal(s.operativeState[engineer].location,origin);assert.equal(s.operativeState[front].fatigue,0);assert.ok(saved({campaign:s}));
});
