import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,teamCanSee,canSee} from '../game/tactical.js';
import {sameCell,spacePoint} from '../game/tactical-space.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {visit,saved} from './local-contract-fixture.mjs';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {rosterFor,dispatchCampaign} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {visibleMedicalPatrolStep} from './route-visible-medical-remains.mjs';
import {recoverRecapturedRoad} from './recovery-road-care.mjs';
import {discoverRouteCache} from './finite-route-equipment.mjs';
import {refreshMilitaryCondition} from '../game/actor-condition.js';

// Declared subsystem arenas only. No earned input, native historical outcome,
// campaign prefix or original whole-file oracle is replaced here.
const grid=()=>Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0}));
const clock=s=>s.hour*3600+(s.secondOfHour??0);
const arena=side=>createBattle([{id:'p',x:1,y:2,facing:6}],{width:16,height:10,tiles:grid(),exploration:true,deferContact:true,enemies:[],seed:45,artillery:[{id:'gun',type:'swivel',side,loaded:true,ammo:3,x:6,y:2}]});

test('public medical patrol ignores an unseen gun in planning while the native executor stops at its real cell',()=>{
 const b=arena('enemy'),before=structuredClone(b),u=b.units[0],goal={x:12,y:2,tacticalLevel:0},clear=structuredClone(b);clear.artillery=[];
 assert.equal(teamCanSee(b,'player',b.artillery[0]),false);
 const step=visibleMedicalPatrolStep(b,u,goal);assert.deepEqual(step,visibleMedicalPatrolStep(clear,clear.units[0],goal));
 assert.ok(step.path.some(point=>sameCell(point,b.artillery[0])));
 const action={type:'move',unitId:u.id,...spacePoint(step)},next=actBattle(b,action);
 assert.equal(next.lastError,null);assert.deepEqual(next,presentedActBattle(b,action).state);assert.deepEqual(next,actBattle(JSON.parse(JSON.stringify(b)),action));
 assert.deepEqual(spacePoint(next.units[0]),{x:5,y:2,tacticalLevel:0});assert.ok(next.elapsedSeconds>b.elapsedSeconds);assert.ok(next.units[0].energy<u.energy);
 for(const key of ['hp','ammo','loaded','inventory'])assert.deepEqual(next.units[0][key],u[key]);assert.deepEqual(next.artillery,b.artillery);assert.equal(next.seed,b.seed);assert.deepEqual(b,before);
});

test('public medical patrol plans around an owned cannon without using its occupied cell',()=>{
 const b=arena('player'),before=structuredClone(b),step=visibleMedicalPatrolStep(b,b.units[0],{x:12,y:2,tacticalLevel:0});assert.ok(step);
 for(const point of step.path)assert.equal(sameCell(point,b.artillery[0]),false);
 const action={type:'move',unitId:'p',...spacePoint(step)},next=actBattle(b,action);assert.equal(next.lastError,null);
 assert.deepEqual(next,presentedActBattle(b,action).state);assert.deepEqual(next,actBattle(JSON.parse(JSON.stringify(b)),action));assert.deepEqual(spacePoint(next.units[0]),spacePoint(step));
 assert.deepEqual(next.artillery,b.artillery);assert.equal(next.seed,b.seed);assert.ok(next.elapsedSeconds>b.elapsedSeconds);assert.deepEqual(b,before);
});

function declaredClinic({known=false,closed=false}={}){
 let c=initialCampaign(906);
 for(const id of c.recruited)c.operativeState[id].medkits=0;
 c.operativeState[3].hp=c.operativeState[3].maxHp-6;c.operativeState[3].bandaged=6;
 const p=visit(c),b=structuredClone(p.battle),doctor=b.units.find(u=>u.id==='10');
 for(const prop of b.props)if(prop.type==='chest'&&prop.contents){prop.open=!closed;prop.knownToPlayer=!closed;prop.contents=prop.contents.filter(item=>item.item!=='medkits');}
 const body={...structuredClone(doctor),id:'declared-remains',side:'enemy',hp:0,ap:0,maxAP:0,bleeding:0,bandaged:0,medkits:1,knownToPlayer:known,routed:false,surrendered:false,x:closed?2:doctor.x+1,y:closed?18:doctor.y};refreshMilitaryCondition(body);
 assert.equal(b.units.some(u=>u.hp>0&&sameCell(u,body)),false);assert.equal(canSee(b,doctor,body),!closed);
 b.units.push(body);c=p.campaign;c.pendingBattle=null;c.sectorStates.retiro=b;
 return saved({campaign:c}).campaign;
}

for(const known of [false,true])test(`declared clinic completes real finite care from a ${known?'known':'visible uninspected'} body and exactly replays the official input`,()=>{
 const start=declaredClinic({known}),before=structuredClone(start),model=sectorInventoryModel(start,'retiro',rosterFor(start),10);
 assert.equal(model.reason,null);assert.equal(model.entries.filter(row=>JSON.parse(row.expected).item==='medkits').length,known?1:0);
 const result=recoverRecapturedRoad(start),s=result.campaign,replay=recoverRecapturedRoad(decodeSave(encodeSave(start)).campaign);
 assert.deepEqual(result,replay);assert.deepEqual(start,before);assert.equal(s.operativeState[3].hp,s.operativeState[3].maxHp);assert.equal(s.operativeState[3].bleeding,0);
 assert.equal(s.sectorStates.retiro.units.find(u=>u.id==='declared-remains').medkits,0);assert.equal(s.operativeState[10].medkits,0);
 const inspection=result.events.filter(event=>event.event==='visibleMedicalRemains');assert.equal(inspection.length,known?0:1);
 if(!known){assert.equal(inspection[0].collected,1);assert.ok(inspection[0].elapsedSeconds>0);assert.ok(inspection[0].actions.some(a=>a.type==='approachLoot'));assert.ok(inspection[0].actions.some(a=>a.type==='loot'));}
 assert.equal(s.resources.treasury,start.resources.treasury);assert.ok(clock(s)>clock(start));
 for(const id of start.recruited){assert.ok(s.recruited.includes(id));assert.equal(s.operativeState[id].alive,true);assert.deepEqual(s.contracts[id],start.contracts[id]);}
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(s.operativeState[id].alive,false);assert.equal(s.operativeState[id].hp,0);}
 assert.deepEqual(s.artilleryDepots,start.artilleryDepots);assert.deepEqual(s.artilleryTransfers,start.artilleryTransfers);assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
});

test('declared closed empty-cache discovery retains its entire native state and time before visible care',()=>{
 const start=declaredClinic({closed:true}),before=structuredClone(start),result=recoverRecapturedRoad(start),checkpoint=result.events.find(e=>e.event==='finiteCareCacheChecked');assert.ok(checkpoint);
 let replay=start;
 for(const row of result.events){if(row===checkpoint)break;if(row.action){replay=dispatchCampaign(replay,row.action);assert.equal(replay.lastError,null);}}
 const discovered=discoverRouteCache(replay,10);assert.deepEqual(checkpoint.campaign,discovered,'The actual adopted discovery prefix must be retained before the empty-source refusal.');
 assert.ok(clock(discovered)>clock(replay),'Opening the initially closed cache pays actual native time.');
 const chest=discovered.sectorStates.retiro.props.find(p=>p.id==='retiro:armory-cache');assert.equal(chest.open,true);assert.equal(chest.knownToPlayer,true);assert.equal(chest.contents.some(s=>s.item==='medkits'),false);
 const inspection=result.events.find(e=>e.event==='visibleMedicalRemains');assert.equal(inspection.collected,1);assert.equal(result.campaign.operativeState[3].hp,result.campaign.operativeState[3].maxHp);
 assert.ok(clock(result.campaign)>clock(discovered));assert.deepEqual(result,recoverRecapturedRoad(decodeSave(encodeSave(start)).campaign));assert.deepEqual(start,before);
});
