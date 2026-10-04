import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,endTurn,presentedEndTurn,actBattle,teamCanSee} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {defaultContentPackage} from '../game/content-package.js';
import {compileWeaponDefinition} from '../game/weapon-definition.js';

const actor=(state,id='p')=>state.units.find(u=>u.id===id);
function field(player={},extra={}){
 const state=createBattle([{id:'p',name:'Defensor',x:7,y:3,facing:6,weapon:1800,loaded:0,agility:75,wisdom:50,skillPractice:{agility:39},practiceSeed:0,...player}],{width:20,height:8,seed:3,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',name:'Tirador hostil',x:1,y:3,facing:2,weapon:1800,marksmanship:42,loaded:1,ammo:0,condition:100,patrol:false,overwatch:false}],...extra});
 actor(state).ap=0;actor(state,'e').ap=12;return state;
}
const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
const save=(campaign,battle)=>{const next=syncBattleTime(campaign,battle);assert.equal(next.error,null,next.error);return decodeSave(encodeSave(next.campaign,next.battle));};

test('an actual hostile discharged miss earns one chance and has identical ordinary, presented and saved replay results',()=>{
 const state=field(),before=structuredClone(state),ordinary=endTurn(state),presented=presentedEndTurn(state);
 assert.equal(ordinary.lastError,null);assert.deepEqual(presented.state,ordinary);assert.deepEqual(endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(state)))),ordinary);assert.deepEqual(state,before);
 assert.equal(actor(ordinary).hp,actor(state).hp);assert.equal(actor(ordinary).agility,76);assert.equal(actor(ordinary).trainedStats.agility,1);assert.equal(actor(ordinary).skillPractice.agility,0);assert.equal(actor(ordinary).practiceSeed,1013904223);
 assert.equal(actor(ordinary,'e').loaded,0);assert.equal(actor(ordinary,'e').ap,0);assert.equal(ordinary.elapsedSeconds,6);assert.equal(presented.frames.filter(frame=>frame.type==='projectile').length,1);
 assert.ok(ordinary.log.some(line=>line.includes('sin acertar al punto elegido')));assert.ok(!ordinary.log.some(line=>/agilidad|aprendizaje/i.test(line)));
 const lowWisdom=endTurn(field({wisdom:10}));assert.equal(actor(lowWisdom).agility,75);assert.equal(actor(lowWisdom).practiceSeed,actor(ordinary).practiceSeed);assert.equal(lowWisdom.seed,ordinary.seed);assert.equal(actor(lowWisdom).hp,actor(ordinary).hp);assert.equal(actor(lowWisdom,'e').loaded,actor(ordinary,'e').loaded);assert.deepEqual(lowWisdom.log,ordinary.log);
});

test('actual stopped rays, hits and misfires cannot earn near-miss progress',()=>{
 const blocked=field();Object.assign(blocked.tiles.find(tile=>tile.x===6&&tile.y===4),{type:'wall',material:'stone',blocked:true,blocksSight:false});const stopped=endTurn(blocked);assert.equal(actor(stopped).practiceSeed,0);assert.equal(actor(stopped).skillPractice.agility,39);
 const hit=field();actor(hit,'e').marksmanship=100;const wounded=endTurn(hit);assert.ok(actor(wounded).hp<actor(hit).hp);assert.equal(actor(wounded).practiceSeed,0);assert.equal(actor(wounded).agility,75);
 const jammed=field({}, {weather:{rain:100,humidity:100}});const failed=endTurn(jammed);assert.equal(actor(failed,'e').jammed,true);assert.equal(actor(failed,'e').loaded,1);assert.equal(actor(failed).practiceSeed,0);assert.equal(actor(failed).skillPractice.agility,39);
});

test('a real authored single-ball discharge can teach, while an actual bodyguard wound prevents learning',()=>{
 const authored=field(),definition={...defaultContentPackage().weapons.find(weapon=>weapon.template===1800),id:'authored-near-miss-musket',name:'Mosquete de práctica'};actor(authored,'e').contentWeapon=compileWeaponDefinition(definition);
 const learned=endTurn(authored);assert.equal(actor(learned,'e').contentWeapon.id,definition.id);assert.equal(actor(learned,'e').loaded,0);assert.equal(actor(learned).hp,100);assert.equal(actor(learned).agility,76);
 const redirected=field({abilities:['bodyguard']});actor(redirected).ap=8;redirected.units.push({...structuredClone(actor(redirected)),id:'protected',name:'Compañero protegido',x:8,y:4,leadership:95,abilities:[],ap:0});
 const wounded=presentedEndTurn(redirected);assert.deepEqual(wounded.state,endTurn(redirected));assert.ok(wounded.state.log.some(line=>line.includes('se interpone')));assert.ok(actor(wounded.state).hp<100);assert.equal(actor(wounded.state,'protected').hp,100);assert.equal(actor(wounded.state).practiceSeed,0);assert.equal(actor(wounded.state).skillPractice.agility,39);assert.equal(actor(wounded.state).agility,75);
});

test('an unseen interception and stop cannot disclose a new identity or grant distant practice',()=>{
 const state=field({facing:0},{npcs:[{id:'hidden-body',name:'Persona secreta',x:5,y:4,hp:100,maxHp:100,energy:100,stance:'standing'}]});Object.assign(state.tiles.find(tile=>tile.x===6&&tile.y===4),{type:'wall',material:'stone',blocked:true,blocksSight:true});
 assert.equal(teamCanSee(state,'player',state.npcs[0]),false);const presented=presentedEndTurn(state);assert.deepEqual(presented.state,endTurn(state));assert.equal(actor(presented.state).practiceSeed,0);assert.ok(presented.state.npcs[0].hp<100);
 assert.ok(!presented.state.log.some(line=>line.includes('Persona secreta')));for(const frame of presented.frames){assert.ok(!frame.impacts.some(impact=>impact.unitId==='hidden-body'));assert.ok(!JSON.stringify(frame.shotVisual??{}).includes('hidden-body'));}
});

test('real paid battle near-miss growth survives full save, retreat, settlement and reentry without duplicate result credit',()=>{
 let campaign=order(initialCampaign(8),{type:'recruitCivic',id:110,term:'month'});const baseline=rosterFor(campaign).find(u=>u.id===110).agility;
 // An isolated veteran one learning credit below improvement, with the issued
 // force/gear and a public enemy turn on a walkable arrival boundary.
 Object.assign(campaign.operativeState[110],{skillPractice:{agility:39},practiceSeed:0});campaign=order(campaign,{type:'attack',sector:'buenos_aires'});const request=campaign.pendingBattle,width=64,height=48;
 let battle=createBattle(request.squad.map(u=>({...u,x:7,y:0,facing:6})),{...request,width,height,seed:3,tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),props:[],npcs:request.npcs,enemies:request.enemies.map((u,i)=>({...u,x:i?50:1,y:i?35+i:0,facing:2,marksmanship:i?u.marksmanship:42,patrol:false,overwatch:false}))});
 for(const unit of battle.units)unit.ap=unit.side==='enemy'&&unit.id===battle.units.find(u=>u.side==='enemy').id?12:0;
 const treasury=campaign.resources.treasury,loaded=battle.units.find(u=>u.side==='enemy').loaded,health=actor(battle,'110').hp;
 const initial=save(campaign,battle);({campaign,battle}=initial);battle=endTurn(battle);assert.equal(battle.lastError,null);assert.equal(actor(battle,'110').hp,health);assert.equal(actor(battle,'110').agility,baseline+1);assert.equal(battle.units.find(u=>u.side==='enemy').loaded,loaded-1);
 assert.deepEqual(endTurn(initial.battle),battle);({campaign,battle}=save(campaign,battle));assert.equal(campaign.resources.treasury,treasury);
 const exit=battle.exits.find(e=>e.destination==='retiro'),ap=actor(battle,'110').ap;battle=actBattle(battle,{type:'exit',unitIds:['110'],exitId:exit.id});assert.equal(battle.lastError,null);assert.equal(battle.status,'retreat');assert.ok(actor(battle,'110').ap<ap);
 const result={type:'battleResult',battleId:request.id,outcome:'retreat',sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')};campaign=order(campaign,result);campaign=decodeSave(encodeSave(campaign)).campaign;
 assert.equal(campaign.operativeState[110].trainedStats.agility,1);assert.equal(campaign.operativeState[110].skillPractice.agility,0);assert.equal(campaign.operativeState[110].practiceSeed,actor(battle,'110').practiceSeed);assert.equal(rosterFor(campaign).find(u=>u.id===110).agility,baseline+1);assert.equal(campaign.resources.treasury,treasury);
 const repeated=dispatchCampaign(campaign,result);assert.ok(repeated.lastError);assert.deepEqual({...repeated,lastError:null},campaign);
 campaign=order(campaign,{type:'visitSector'});const pair=prepareCampaignBattle(campaign);assert.equal(pair.error,null);assert.equal(actor(pair.battle,'110').agility,baseline+1);assert.equal(actor(pair.battle,'110').practiceSeed,actor(battle,'110').practiceSeed);save(pair.campaign,pair.battle);
});
