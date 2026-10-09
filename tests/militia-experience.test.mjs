import {initializeUnitAmmunition} from '../game/tactical-ammunition.js';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {createBattle,endTurn} from '../game/tactical.js';
import {prepareGarrison,returnGarrison} from '../game/garrison.js';
import {recordMilitiaHit,earnedMilitiaRank,validMilitiaExperience} from '../game/militia-experience.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {enterSector} from '../game/world.js';
import {previousDeploymentScene,retainedMilitaryBodies} from '../game/military-remains.js';
const step=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const flat=()=>Array.from({length:320},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0}));
function ready(){const s=initialCampaign();s.sectors.retiro.militia=[3,0,0];prepareGarrison(s,'retiro');return s;}
function encounter(s){
 s=step(s,{type:'visitSector'});const r=s.pendingBattle;
 // The declared deployment fixture isolates militia custody. No result or
 // combat credit is inserted; ordinary fire must kill the declared opponent.
 r.enemies=[{id:'raider',name:'Asaltante',x:3,y:2,weapon:1813,hp:30,maxHp:30,morale:100,overwatch:false,patrol:false}].map(u=>initializeUnitAmmunition(u));
 const squad=[...r.squad.map((u,i)=>({...u,x:1,y:5+i})),...r.garrison.map(u=>({...u,x:u.id===20000?1:16,y:u.id===20000?2:10+(u.id-20000)}))];
 let b=createBattle(squad,{...r,hour:s.hour,secondOfHour:s.secondOfHour??0,exploration:false,width:20,height:16,tiles:flat(),props:[],npcs:r.npcs.map((npc,i)=>({...npc,x:12-i,y:14})),seed:45});b.units.find(u=>u.side==='enemy').ap=0;
 const previous=previousDeploymentScene(s,r),bodyIds=new Set(retainedMilitaryBodies(previous,[...r.squad,...r.garrison,...r.enemies],r.sector).filter(u=>u.side==='enemy'&&!u.departure).map(u=>u.id));
 const bodies=bodyIds.size?enterSector(r,previous).units.filter(u=>bodyIds.has(u.id)):[];assert.equal(bodies.length,bodyIds.size);b.units.push(...structuredClone(bodies));
 return {s,b,bodies};
}
function fightAndReturn(s){
 let b;({s,b}=encounter(s));const id=String(s.pendingBattle.garrison[0].id),old=structuredClone(s.pendingBattle.garrison[0]);
 b=endTurn(b);assert.equal(b.lastError,null);assert.equal(b.units.find(u=>u.side==='enemy').hp,0);assert.equal(b.status,'victory');
 assert.doesNotThrow(()=>validateBattleSnapshot(b));const actual=b.units.find(u=>u.id===id),before=structuredClone(s);
 s=step(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});return {s,b,old,actual,before};
}

test('real paid kills promote a survivor through two ranks without a new soldier, healing or equipment',()=>{
 let s=ready();const initialLog=s.log[0].text,first=s.garrisons.retiro[0];Object.assign(first,{weapon:1800,marksmanship:100,condition:100,hp:44,bandaged:16,energy:77,jammed:false});setTestAmmunition(first,5);
 let result=fightAndReturn(s);s=result.s;let unit=s.garrisons.retiro.find(u=>u.id===first.id);assert.equal(unit.militiaRank,1);assert.equal(unit.militiaExperience,3);assert.ok(s.log.findIndex(e=>e.text.includes('asciende por experiencia'))<s.log.findIndex(e=>e.text===initialLog));assert.deepEqual(s.sectors.retiro.militia,[2,1,0]);
 for(const k of ['hp','maxHp','weapon','loaded','ammo','condition','inventory','bleeding','bandaged','energy','weaponFittings'])assert.deepEqual(unit[k],result.actual[k]);assert.equal(s.nextMilitiaId,20003);
 s=restoreCampaign(serializeCampaign(s));unit=s.garrisons.retiro.find(u=>u.id===first.id);
 // The next encounter still uses the earned soldier and his finite rounds.
 let pair=encounter(s);let b=endTurn(pair.b);assert.equal(b.lastError,null);assert.equal(b.status,'victory');
 s=step(pair.s,{type:'leaveSector',battleId:pair.s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});unit=s.garrisons.retiro.find(u=>u.id===first.id);assert.equal(unit.militiaRank,2);assert.equal(unit.militiaExperience,6);assert.deepEqual(s.sectors.retiro.militia,[2,0,1]);assert.equal(unit.hp,44);assert.equal(unit.maxHp,60);assert.equal(unit.weapon,1800);assert.equal(unit.ammo,4);assert.equal(s.nextMilitiaId,20003);assert.equal(unit.militiaCombatCredit.length,2);assert.notEqual(...unit.militiaCombatCredit.map(e=>e.id));
 for(const body of pair.bodies){const kept=s.sectorStates.retiro.units.find(u=>u.id===body.id);assert.ok(kept);for(const key of ['hp','maxHp','originalUnitId','weapon','blade','loaded','ammo','condition','inventory','weaponFittings'])assert.deepEqual(kept[key],body[key],`${body.id}: ${key}`);}
 s=restoreCampaign(serializeCampaign(s));s=step(s,{type:'visitSector'});const revisited=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.equal(revisited.units.find(u=>u.id===String(first.id)).militiaRank,2);assert.equal(revisited.units.find(u=>u.id===String(first.id)).hp,44);
});
test('first wounds and subsequent kills have bounded credit; allies and helpless targets grant none',()=>{
 const s={battleId:'one'},u={id:'m',militia:true,militiaRank:0,hp:60,side:'player'},target={id:'e',side:'enemy',hp:50};
 recordMilitiaHit(s,u,target,true,20);assert.equal(u.militiaExperience,1);recordMilitiaHit(s,u,target,true,10);assert.equal(u.militiaExperience,1);target.hp=0;recordMilitiaHit(s,u,target,true,50);assert.equal(u.militiaExperience,3);recordMilitiaHit(s,u,target,true,10);assert.equal(u.militiaExperience,3);
 for(const victim of [{id:'ally',hp:20,side:'player'},{id:'helpless',hp:0,side:'enemy'}])recordMilitiaHit(s,u,victim,victim.id!=='helpless',10);assert.equal(u.militiaExperience,3);assert.equal(u.militiaCombatCredit.length,1);assert.ok(validMilitiaExperience(u));
});
test('reentering the same unfinished encounter retains opponent identity and prevents repeated wound credit',()=>{
 const s=ready(),issued=s.garrisons.retiro[0],request={id:'first',sector:'retiro',squad:[],garrison:[issued],enemies:[{id:'e',hp:100}],seed:45};
 const old=enterSector(request),u=old.units.find(u=>u.militia),e=old.units.find(u=>u.side==='enemy');recordMilitiaHit(old,u,e,true,10);const current={...issued,militiaExperience:u.militiaExperience,militiaCombatCredit:u.militiaCombatCredit};
 const next=enterSector({...request,id:'second',garrison:[current]},old),again=next.units.find(u=>u.militia),target=next.units.find(u=>u.side==='enemy');assert.equal(target.militiaCreditId,e.militiaCreditId);recordMilitiaHit(next,again,target,true,10);assert.equal(again.militiaExperience,1);
});
test('a peaceful return cannot promote from old points and dead or dispersed militia do not gain rank',()=>{
 const s=ready(),issued=s.garrisons.retiro[0],actual={...structuredClone(issued),militiaExperience:3,militiaCombatCredit:[{id:'old',points:3}]};assert.equal(earnedMilitiaRank(actual,actual),0);assert.equal(earnedMilitiaRank(issued,{...actual,hp:0}),0);
 const request={sector:'retiro',garrison:[issued]},b={units:[{...actual,id:String(issued.id),side:'player'}]};returnGarrison(s,request,b,[{unitId:String(issued.id),kind:'dispersed'}]);assert.deepEqual(s.sectors.retiro.militia,[2,0,0]);assert.ok(!s.garrisons.retiro.some(u=>u.id===issued.id));
});
test('a withdrawing veteran counts at the destination only, with the same damaged gear',()=>{
 const s=ready(),issued=s.garrisons.retiro[0];issued.militiaRank=1;s.sectors.retiro.militia=[2,1,0];const actual={...structuredClone(issued),id:String(issued.id),side:'player',hp:37,condition:43,militiaExperience:6,militiaCombatCredit:[{id:'a',points:3},{id:'b',points:3}]};
 returnGarrison(s,{sector:'retiro',garrison:[issued]},{units:[actual]},[{unitId:actual.id,kind:'departed',sector:'buenos_aires',departure:{entryEdge:'E',entryAnchor:{x:19,y:4}}}]);assert.deepEqual(s.sectors.retiro.militia,[2,0,0]);assert.deepEqual(s.sectors.buenos_aires.militia,[0,0,1]);assert.equal(s.garrisons.buenos_aires[0].id,issued.id);assert.equal(s.garrisons.buenos_aires[0].condition,43);assert.equal(s.garrisons.buenos_aires[0].hp,37);
});
test('paid regular training reserves actual soldiers and preserves wounds, ammo and experience on completion',()=>{
 let s=ready();Object.assign(s.garrisons.retiro[0],{hp:37,condition:41,ammo:2,loaded:0,militiaExperience:1,militiaCombatCredit:[{id:'prior',points:1}]});setTestAmmunition(s.garrisons.retiro[0],2);const original=structuredClone(s.garrisons.retiro),rounds=s.resources.cartridges,horses=s.resources.horses;
 s=step(s,{type:'militia',rank:1,trainerId:4});assert.equal(s.militiaTraining[0].trainees.length,3);assert.equal(s.garrisons.retiro.length,0);assert.equal(s.resources.cartridges,rounds);assert.equal(s.resources.horses,horses);s=restoreCampaign(serializeCampaign(s));for(let n=0;s.militiaTraining.length&&n<12;n++)s=step(s,{type:'wait',hours:s.militiaTraining[0].remaining+12});assert.equal(s.militiaTraining.length,0,'course must finish after sleep pauses');assert.deepEqual(s.sectors.retiro.militia,[0,3,0]);
 for(const old of original){const u=s.garrisons.retiro.find(v=>v.id===old.id);assert.equal(u.militiaRank,1);for(const k of ['hp','condition','loaded','ammo','weapon','blade','inventory','militiaExperience','militiaCombatCredit'])assert.deepEqual(u[k],old[k]);}assert.equal(s.resources.cartridges,rounds);assert.equal(s.nextMilitiaId,20003);
});
test('cancelling training returns the same reserved militia and the course rejects deployed soldiers',()=>{
 let s=restoreCampaign(serializeCampaign(ready())),original=structuredClone(s.garrisons.retiro);s=step(s,{type:'militia',rank:1,trainerId:4});s=step(s,{type:'cancelMilitia',sector:'retiro'});assert.deepEqual(s.garrisons.retiro,original);assert.deepEqual(s.sectors.retiro.militia,[3,0,0]);
 s=step(s,{type:'visitSector'});const blocked=dispatchCampaign(s,{type:'militia',rank:1,trainerId:4});assert.ok(blocked.lastError);assert.deepEqual(blocked.resources,s.resources);assert.deepEqual(blocked.garrisons,s.garrisons);
});
test('new courses cannot buy veteran status; previously paid top-rank courses remain recoverable',()=>{
 let s=initialCampaign();s.sectors.retiro.militia=[0,3,0];const blocked=dispatchCampaign(s,{type:'militia',rank:2,trainerId:4});assert.match(blocked.lastError,/veteranos/);assert.deepEqual(blocked.resources,s.resources);assert.deepEqual(blocked.militiaTraining,[]);
 s.sectors.retiro.militia=[0,0,0];s.militiaTraining=[{sector:'retiro',rank:2,trainerId:4,count:3,remaining:1,duration:48,started:0}];s=restoreCampaign(serializeCampaign(s));s=step(s,{type:'wait',hours:1});assert.deepEqual(s.sectors.retiro.militia,[0,0,3]);
});
test('malformed, duplicated or lost combat credit and duplicate trainees are rejected on restore',()=>{
 const good={militia:true,militiaRank:1,militiaExperience:3,militiaCombatCredit:[{id:'a',points:3}]};for(const change of [u=>u.militiaExperience=-1,u=>u.militiaExperience=4,u=>u.militiaCombatCredit.push({id:'a',points:3}),u=>u.militiaCombatCredit[0].points=2,u=>u.militiaCombatCredit[0].secret=1]){const u=structuredClone(good);change(u);assert.equal(validMilitiaExperience(u),false);}
 assert.throws(()=>earnedMilitiaRank(good,{...good,militiaExperience:0,militiaCombatCredit:[]}));
 let s=step(ready(),{type:'militia',rank:1,trainerId:4});s.militiaTraining[0].trainees[1].id=s.militiaTraining[0].trainees[0].id;assert.throws(()=>restoreCampaign(serializeCampaign(s)));
});
test('public militia progress excludes opponent-credit identities',()=>{
 const b=createBattle([{id:'m',militia:true,militiaRank:1,militiaExperience:3,militiaCombatCredit:[{id:'secret-opponent',points:3}]}],{width:20,height:16,tiles:flat(),enemies:[]});const view=playerKnownBattle(b);assert.equal(view.units[0].militiaExperience,3);assert.equal(view.units[0].militiaRank,1);assert.ok(!JSON.stringify(view).includes('secret-opponent'));
});

test('training cannot hide unstable soldiers or duplicate identified fittings across course custody',()=>{
 let s=ready();s.garrisons.retiro[0].bleeding=1;let blocked=dispatchCampaign(s,{type:'militia',rank:1,trainerId:4});assert.ok(blocked.lastError);assert.deepEqual(blocked.garrisons,s.garrisons);assert.deepEqual(blocked.resources,s.resources);
 s=ready();Object.assign(s.garrisons.retiro[0],{weapon:1800,weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'training-fitting',condition:32}}});setTestAmmunition(s.garrisons.retiro[0],5);s=step(s,{type:'militia',rank:1,trainerId:4});s=restoreCampaign(serializeCampaign(s));assert.equal(s.militiaTraining[0].trainees[0].weaponFittings.bayonet.instanceId,'training-fitting');
 const duplicate=structuredClone(s);duplicate.militiaTraining[0].trainees[1].weapon=1800;setTestAmmunition(duplicate.militiaTraining[0].trainees[1],5);duplicate.militiaTraining[0].trainees[1].weaponFittings=structuredClone(duplicate.militiaTraining[0].trainees[0].weaponFittings);assert.throws(()=>restoreCampaign(serializeCampaign(duplicate)));
 s=step(s,{type:'cancelMilitia',sector:'retiro'});assert.equal(s.garrisons.retiro[0].weaponFittings.bayonet.condition,32);assert.deepEqual(restoreCampaign(serializeCampaign(s)).garrisons,s.garrisons);
});
