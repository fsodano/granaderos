import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,firearmFlightPreview,firearmVolleyPreview,shotChance,actionCosts,teamCanSee} from '../game/tactical.js';
import {targetPreview,chancePercent} from '../game/ja2-hud.js';
import {tinyFirearmChanceField} from './tiny-firearm-chance-fixture.mjs';
function field(extra={}){
 const state=createBattle([{id:'p',name:'Tirador',x:1,y:3,facing:2,weapon:1802,marksmanship:100,loaded:1,...extra}],{width:20,height:8,seed:45,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',name:'Objetivo',x:9,y:3,overwatch:false,patrol:false}]});
 const player=state.units[0],target=state.units[1];player.ap=100;state.units.push({...structuredClone(player),id:'friend',name:'Aliado visible',x:4,y:3});return {state,player,target};
}

test('the HUD shows observed body passage probability and reduced force while retaining named risk and paid cost',()=>{
 const {state,player,target}=field(),before=structuredClone(state),flight=firearmFlightPreview(state,player,target),selected=flight.bodyImpacts.find(hit=>hit.victimKind==='unit'&&hit.victimId===target.id);
 assert.ok(selected.reachChance>0&&selected.reachChance<1);assert.ok(selected.damageFactor>0&&selected.damageFactor<1);
 const preview=targetPreview(state,player,target,{mode:'fire',aim:4});assert.equal(preview.valid,true);assert.equal(preview.chance,shotChance(state,player,target,4));assert.equal(preview.pa,actionCosts(state,player,target).fire+4*actionCosts(state,player,target).aim);
 assert.equal(preview.chanceLabel,'impacto con penetración');assert.match(preview.coverNote,new RegExp(`${Math.round(selected.reachChance*100)}% de paso`));assert.match(preview.coverNote,new RegExp(`daño reducido un ${Math.round((1-selected.damageFactor)*100)}% si llega`));assert.match(preview.coverNote,/consume la carga/);assert.match(preview.coverNote,/Personas en la trayectoria: Aliado visible/);assert.deepEqual(state,before);
});

test('both pistol forecasts name their conditional passage and each finite discharge',()=>{
 const {state,player,target}=field({weapon:1806,offHand:{weapon:1805,count:1,loaded:1,condition:100},leftHandItem:'offhand'}),volley=firearmVolleyPreview(state,player,target,4),preview=targetPreview(state,player,target,{mode:'fire',aim:4});
 assert.equal(volley.shots.length,2);assert.equal(preview.actionLabel,'Disparar ambas pistolas');
 for(const shot of volley.shots){assert.ok(shot.conditional);assert.match(preview.coverNote,new RegExp(`${shot.hand==='primary'?'Mano principal':'Segunda mano'}: ${shot.chance}%`));assert.match(preview.coverNote,new RegExp(`incluye ${Math.round(shot.reachChance*100)}% de paso`));}
 assert.match(preview.coverNote,/Un disparo por pistola/);assert.match(preview.coverNote,/consume las cargas/);assert.match(preview.coverNote,/Aliado visible/);
});

test('a concealed intervening body cannot add a forecast identity or conditional cue',()=>{
 const {state,player,target}=field();state.units.pop();state.night=true;player.x=0;target.x=10;state.lights=[{id:'lamp',x:10,y:3,radius:1,intensity:1,turns:10}];
 state.units.push({...structuredClone(target),id:'hidden',name:'Identidad privada',x:7,y:3});assert.equal(teamCanSee(state,'player',state.units[2]),false);
 const empty=structuredClone(state);empty.units.pop();const preview=targetPreview(state,player,target,{mode:'fire',aim:4});assert.deepEqual(preview,targetPreview(empty,empty.units[0],empty.units[1],{mode:'fire',aim:4}));assert.doesNotMatch(JSON.stringify(preview),/privada|penetración|de paso/);
});

test('a body beyond the selected target does not make its hit forecast conditional',()=>{
 const {state,player,target}=field();state.units[2].x=12;const preview=targetPreview(state,player,target,{mode:'fire',aim:4});assert.equal(preview.chanceLabel,undefined);assert.doesNotMatch(preview.coverNote,/paso hasta el objetivo|impacto con penetración/);
});

test('a physically possible tiny conditional path displays below one percent without changing its probability',()=>{
 const {state,player,target}=tinyFirearmChanceField(),before=structuredClone(state),flight=firearmFlightPreview(state,player,target,'head'),selected=flight.bodyImpacts.at(-1),preview=targetPreview(state,player,target,{mode:'fire',aim:4,hitLocation:'head'});
 assert.equal(selected.victimId,target.id);assert.equal(selected.incomingImpact,10);assert.ok(selected.reachChance>0&&selected.reachChance<.01);assert.ok(preview.chance>0&&preview.chance<1);
 assert.equal(preview.chance,shotChance(state,player,target,4,'head'));assert.match(preview.coverNote,/<1% de paso hasta el objetivo/);assert.doesNotMatch(preview.coverNote,/ 0% de paso/);assert.equal(chancePercent(preview.chance),'<1%');assert.equal(chancePercent(0),'0%');assert.equal(chancePercent(42),'42%');assert.deepEqual(state,before);
});

test('both physically possible tiny pistol chances and passage cues display below one percent',()=>{
 const {state,player,target}=tinyFirearmChanceField({paired:true}),before=structuredClone(state),volley=firearmVolleyPreview(state,player,target,4,'head'),preview=targetPreview(state,player,target,{mode:'fire',aim:4,hitLocation:'head'});
 assert.equal(volley.shots.length,2);assert.ok(volley.shots.every(shot=>shot.chance>0&&shot.chance<1&&shot.reachChance>0&&shot.reachChance<.01));assert.match(preview.coverNote,/Mano principal: <1% \(incluye <1% de paso\)/);assert.match(preview.coverNote,/Segunda mano: <1% \(incluye <1% de paso\)/);assert.doesNotMatch(preview.coverNote,/0% de paso|0\.0/);assert.deepEqual(state,before);
});
