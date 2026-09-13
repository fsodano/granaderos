import {syncUnitAmmunition} from '../game/tactical-ammunition.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {shotRangeModifiers,shotRangeText} from '../game/shot-range.js';
import {createBattle,actBattle,shotChance,firearmRangeProfile,firearmShotOptions,canSee,visibleDistance,actionCosts,hasLineOfSight,pointFirePreview,teamCanSee} from '../game/tactical.js';
import {targetPreview} from '../game/ja2-hud.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const field=(extra={})=>createBattle([{id:'p',x:1,y:2,weapon:1800,marksmanship:65}],{width:32,height:6,seed:5,hour:12,tiles:Array.from({length:192},(_,i)=>({x:i%32,y:Math.floor(i/32),type:'grass'})),enemies:[{id:'e',x:11,y:2,weapon:1800,patrol:false}],...extra});
test('physical weapon reach and apparent sight range produce independent cumulative penalties',()=>{
 const base=shotRangeModifiers({distance:10,weaponRange:18,visibleRange:16});assert.equal(base.weaponPenalty,7);assert.equal(base.sightAdjustment,-3);assert.equal(base.chanceFactor,1);
 const short=shotRangeModifiers({distance:10,weaponRange:8,visibleRange:16});assert.equal(short.weaponPenalty,12);assert.equal(short.sightAdjustment,base.sightAdjustment);assert.equal(short.chanceFactor,.5);
 const hidden=shotRangeModifiers({distance:10,weaponRange:18,visibleRange:6});assert.equal(hidden.weaponPenalty,base.weaponPenalty);assert.equal(hidden.effectiveSightRange,14);assert.equal(hidden.sightAdjustment,-15);assert.equal(hidden.chanceFactor,.5);
 assert.equal(shotRangeModifiers({distance:10,weaponRange:8,visibleRange:6}).chanceFactor,.25);
});
test('exact range boundaries retain full chance and close targets have a sight bonus',()=>{
 assert.equal(shotRangeModifiers({distance:8,weaponRange:8,visibleRange:8}).chanceFactor,1);assert.equal(shotRangeModifiers({distance:8.01,weaponRange:8,visibleRange:8}).chanceFactor,.25);
 assert.equal(shotRangeModifiers({distance:4,weaponRange:18,visibleRange:16}).sightAdjustment,15);
 for(const invalid of [NaN,Infinity,-1])assert.throws(()=>shotRangeModifiers({distance:invalid,weaponRange:18,visibleRange:16}));
});
test('changing gun range changes ballistic difficulty without changing detection or optical range',()=>{
 const s=field(),[u,t]=s.units,base=firearmRangeProfile(s,u,t),short={...u,weapon:1805},baker={...u,weapon:1802};
 assert.equal(firearmRangeProfile(s,short,t).effectiveSightRange,base.effectiveSightRange);assert.equal(visibleDistance(s,u,t),visibleDistance(s,short,t));assert.equal(canSee(s,u,t),canSee(s,short,t));
 assert.ok(shotChance(s,short,t)<shotChance(s,u,t));assert.ok(shotChance(s,baker,t)>shotChance(s,u,t));assert.equal(firearmRangeProfile(s,baker,t).beyondWeapon,false);
});
test('night training and real illumination improve sight without extending the gun',()=>{
 const s=field({hour:0}),[u,t]=s.units; t.x=6;
 const dark=firearmRangeProfile(s,u,t),trained={...u,traits:['night_vision']},basic={...u,traits:['night_vision_basic']};
 assert.equal(dark.weaponRange,18);assert.equal(dark.visibleRange,6);assert.equal(firearmRangeProfile(s,trained,t).visibleRange,8);
 assert.ok(shotChance(s,trained,t)>shotChance(s,basic,t));assert.ok(shotChance(s,basic,t)>shotChance(s,u,t));
 s.lights.push({id:'fire',x:t.x,y:t.y,radius:4,intensity:1});const lit=firearmRangeProfile(s,u,t);assert.equal(lit.apparentRange,5);assert.equal(lit.weaponRange,dark.weaponRange);assert.equal(lit.beyondSight,false);assert.ok(shotChance(s,u,t)>shotChance(field({hour:0}),u,t));
});
test('smoke changes apparent distance and body-region precision without changing physical distance',()=>{
 const s=field(),[u,t]=s.units;t.x=8;const base=firearmRangeProfile(s,u,t),plainHead=shotChance(s,u,t,0,'head');s.smoke.push({x:4,y:2,radius:0,turns:3});const hazy=firearmRangeProfile(s,u,t);
 assert.equal(hazy.distance,base.distance);assert.equal(hazy.weaponPenalty,base.weaponPenalty);assert.equal(hazy.apparentRange,base.apparentRange+4);assert.ok(shotChance(s,u,t,0,'head')<plainHead);
 const torsoLoss=shotChance(s,u,t)-shotChance(s,u,t,0,'head');assert.equal(torsoLoss,Math.round(3*hazy.effectiveSightRange));
 assert.ok(firearmRangeProfile(s,{...u,traits:['line_marksman']},t).apparentRange<hazy.apparentRange);
});
test('team spotting allows a costly distant shot but never reveals an unspotted target',()=>{
 const s=field({enemies:[{id:'e',x:21,y:2,patrol:false}]}),u=s.units[0],t=s.units[1];u.weapon=1802;syncUnitAmmunition(u);
 s.units.push(syncUnitAmmunition({...structuredClone(u),id:'spotter',x:15,y:4,weapon:1800}));assert.equal(canSee(s,u,t),false);assert.equal(teamCanSee(s,'player',t),true);assert.equal(firearmRangeProfile(s,u,t).beyondSight,true);assert.equal(firearmRangeProfile(s,u,t).beyondWeapon,false);
 assert.ok(shotChance(s,u,t,4)>0);const preview=targetPreview(s,u,t,{mode:'fire'});assert.match(preview.coverNote,/Visión difícil/);
 const fired=actBattle(s,{type:'fire',unitId:u.id,targetId:t.id,aim:0});assert.equal(fired.lastError,null);assert.equal(fired.units[0].ap,u.ap-actionCosts(s,u).fire);
 s.units.pop();const rejected=actBattle(s,{type:'fire',unitId:u.id,targetId:t.id});assert.match(rejected.lastError,/compañero/);assert.deepEqual({...rejected,lastError:null,log:s.log},s);
});
test('HUD, AI shot options and real saved fire use the same range inputs and paid aim',()=>{
 const s=field(),[u,t]=s.units;u.weapon=1805;syncUnitAmmunition(u);
 for(const option of firearmShotOptions(s,u,t)){assert.equal(option.chance,shotChance(s,u,t,option.aim,option.hitLocation));}
 const preview=targetPreview(s,u,t,{mode:'fire',aim:2,hitLocation:'legs'});assert.equal(preview.chance,shotChance(s,u,t,2,'legs'));assert.match(preview.coverNote,/Distancia: 10 casillas · alcance del arma: 8/);assert.match(preview.coverNote,/Fuera del alcance eficaz/);
 const before=structuredClone(s),order={type:'fire',unitId:u.id,targetId:t.id,aim:2,hitLocation:'legs'};const fired=actBattle(s,order);assert.equal(fired.lastError,null);assert.equal(fired.units[0].ap,u.ap-preview.pa);assert.equal(fired.units[0].loaded,0);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),order),fired);assert.deepEqual(s,before);
});
test('location-fire previews cannot disclose hidden target attributes through range details',()=>{
 const s=field({hour:0,enemies:[{id:'e',x:25,y:2,patrol:false}]}),u=s.units[0],point={x:25,y:2};const original=targetPreview(s,u,point,{mode:'fire'}),p=pointFirePreview(s,u,point);
 s.units[1].stance='prone';s.units[1].traits=['guerrilla_tactician'];s.units[1].trainedStats={stealth:100};s.units[1].hp=0;
 assert.deepEqual(targetPreview(s,u,point,{mode:'fire'}),original);assert.deepEqual(pointFirePreview(s,u,point),p);assert.equal(original.chance,undefined);
});
test('blocked projectile geometry still overrides any optimistic range bonus',()=>{
 const s=field(),[u,t]=s.units;s.tiles.find(p=>p.x===6&&p.y===2).blocked=true;s.tiles.find(p=>p.x===6&&p.y===2).type='wall';assert.equal(hasLineOfSight(s,u,t),false);assert.equal(shotChance(s,u,t,4),0);
 assert.match(shotRangeText(firearmRangeProfile(s,u,t)),/Distancia: 10/);
});
