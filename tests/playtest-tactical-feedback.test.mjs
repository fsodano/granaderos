import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,getReachable,actionCosts,shotChance,maxActionPoints,hasLineOfSight,teamCanSee} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {fieldPractice,fieldPracticeChance,practice,validateTraining} from '../game/skill-training.js';
import {targetPreview,pickupSelection} from '../game/ja2-hud.js';
import {pointerItemIntent} from '../game/hotkeys.js';
import {battleFrameDuration,battleFrameFocus,battleFramePose,BATTLE_PLAYBACK} from '../game/battle-playback.js';
import {tacticalFeedback,contextualBanter} from '../game/tactical-feedback.js';
import {COMBAT_BALANCE} from '../game/combat-balance.js';
import {effectiveWounds} from '../game/tactical-condition.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {rosterFor as recruitmentRoster,migrateLegacySkillLearning,CIVIC_RECRUITS} from '../game/recruitment.js';
const field=(extra={})=>createBattle([{id:'p',name:'Patriota',x:1,y:2,weapon:1800,marksmanship:80,wisdom:70,...extra}],{width:24,height:8,seed:7,tiles:Array.from({length:192},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',name:'Realista',x:8,y:2,overwatch:false,patrol:false,morale:100}]});

test('skills strictly below 35 cannot learn and 35 is eligible with no guaranteed successful practice roll',()=>{
 for(const value of [0,1,34]){const unit={id:'p',side:'player',hp:100,medical:value,wisdom:100};const before=structuredClone(unit);assert.equal(practice(unit,'medical',100),0);assert.equal(fieldPractice(unit,'medical',100),0);assert.deepEqual(unit,before);}
 const eligible={id:'p',side:'player',hp:100,medical:35,wisdom:50,practiceSeed:0,skillPractice:{medical:39}};
 assert.equal(fieldPracticeChance(eligible,'medical'),65);assert.equal(fieldPractice(eligible,'medical',1),1);assert.equal(eligible.medical,36);
 const failed={id:'p',side:'player',hp:100,medical:99,wisdom:100,practiceSeed:0,skillPractice:{medical:39}};assert.equal(fieldPractice(failed,'medical',1),0);assert.equal(failed.medical,99);assert.equal(failed.skillPractice.medical,39);
});
test('Wisdom changes source-backed learning chances and practice randomness survives save without changing combat randomness',()=>{
 const unit={id:'p',side:'player',hp:100,medical:50};assert.ok(fieldPracticeChance({...unit,wisdom:90},'medical')>fieldPracticeChance({...unit,wisdom:10},'medical'));
 const source=field({skillPractice:{marksmanship:39}}),fired=actBattle(source,{type:'fire',unitId:'p',targetId:'e',aim:2}),restored=validateBattleSnapshot(JSON.parse(JSON.stringify(source)));
 assert.deepEqual(actBattle(restored,{type:'fire',unitId:'p',targetId:'e',aim:2}),fired);assert.ok(Number.isInteger(fired.units[0].practiceSeed));
 const capped=structuredClone(source);capped.units[0].trainedStats={marksmanship:10};const withoutLearning=actBattle(capped,{type:'fire',unitId:'p',targetId:'e',aim:2});assert.equal(withoutLearning.seed,fired.seed);assert.equal(withoutLearning.units[1].hp,fired.units[1].hp);
 for(const seed of [-1,.5,4294967296])assert.throws(()=>validateTraining({practiceSeed:seed}));
});
test('new XP does not teach technical skills while one-time migration preserves skill values already present in old saves',()=>{
 const base=CIVIC_RECRUITS.find(op=>op.id===110),state={operativeState:{110:{xp:200}},skillLearningVersion:1};
 const fresh=recruitmentRoster(state).find(op=>op.id===110);for(const skill of ['marksmanship','mechanical','medical','explosives'])assert.equal(fresh[skill],base[skill]);assert.ok(fresh.strength>base.strength);
 delete state.skillLearningVersion;migrateLegacySkillLearning(state);const migrated=recruitmentRoster(state).find(op=>op.id===110);assert.equal(migrated.marksmanship,Math.min(95,base.marksmanship+8));assert.equal(migrated.explosives,Math.min(95,base.explosives+4));
 state.operativeState[110].xp=900;migrateLegacySkillLearning(state);const later=recruitmentRoster(state).find(op=>op.id===110);assert.equal(later.marksmanship,migrated.marksmanship);assert.equal(later.explosives,migrated.explosives);assert.doesNotThrow(()=>validateTraining(state.operativeState[110]));
 assert.throws(()=>validateTraining({legacySkillBonus:{marksmanship:37}}));assert.throws(()=>validateTraining({legacySkillBonus:{wisdom:1}}));
});
test('a long movement route displays exact cost and remains invalid until the unit can afford it',()=>{
 const s=field(),u=s.units[0];u.ap=5;const target={x:5,y:5},reachable=getReachable(s,u,{previewBudget:true});
 const preview=targetPreview(s,u,target,{mode:'move',reachable});assert.ok(preview.pa>u.ap);assert.equal(preview.valid,false);assert.match(preview.reason,/PA insuficientes/);assert.ok(preview.path.length>0);assert.equal(preview.path.at(-1).x,target.x);
 assert.ok(!getReachable(s,u).some(p=>p.x===target.x&&p.y===target.y));assert.ok(actBattle(s,{type:'move',unitId:u.id,...target}).lastError);
});
test('Ctrl requests pickup and Shift permits moving onto a ground-item cell without pickup',()=>{
 const s=field(),u=s.units[0],point={x:3,y:3};s.groundItems.push({id:'loot',...point,count:1,stack:{kind:'supply',item:'rations',count:1}});
 assert.equal(pointerItemIntent({ctrlKey:true}),'steal');assert.equal(pointerItemIntent({shiftKey:true}),'moveOnly');
 assert.ok(pickupSelection(s,u,point,{mode:'move',itemIntent:'steal'}).length);assert.deepEqual(pickupSelection(s,u,point,{mode:'move',itemIntent:'moveOnly'}),[]);
 const preview=targetPreview(s,u,point,{mode:'move',itemIntent:'moveOnly',reachable:getReachable(s,u,{previewBudget:true})});assert.equal(preview.movement,true);assert.equal(preview.valid,true);
 const moved=actBattle(s,{type:'move',unitId:u.id,...point});assert.equal(moved.lastError,null);assert.equal(moved.groundItems[0].count,1);assert.equal(moved.units[0].rations,u.rations);
});
test('commanded attacks preserve the authoritative result while showing preparation and a visible target reaction',()=>{
 const s=field(),action={type:'fire',unitId:'p',targetId:'e',aim:2},result=presentedActBattle(s,action);assert.deepEqual(result.state,actBattle(s,action));
 const prepare=result.frames.find(f=>f.type==='prepare'),impact=result.frames.find(f=>f.impacts.length);assert.ok(prepare);assert.equal(prepare.state.units[1].hp,100);assert.ok(impact);assert.equal(impact.impacts[0].unitId,'e');assert.equal(impact.impacts[0].damage,100-result.state.units[1].hp);
 assert.equal(battleFrameDuration(impact),BATTLE_PLAYBACK.impact);assert.ok(battleFrameDuration(prepare)>300);const focus=battleFrameFocus(impact);assert.ok(focus.x>s.units[0].x&&focus.x<s.units[1].x);
});
test('an unseen attacker can focus a visible wounded target without exposing the attacker',()=>{
 const s=field(),frame={state:s,unitId:null,type:'result',action:'fire',impacts:[{unitId:'p',x:1,y:2,damage:5}]};assert.deepEqual(battleFrameFocus(frame),{id:'p',x:1,y:2,tacticalLevel:undefined});
});
test('jam and skill feedback appears on the transition once and chatter uses authored personality',()=>{
 const s=field(),after=structuredClone(s);after.units[0].jammed=true;after.units[0].trainedStats={marksmanship:1};
 assert.deepEqual(tacticalFeedback(s,after),['Patriota: Puntería +1','Patriota: Brown Bess atascada. Volvé a cebar la cazoleta.']);assert.deepEqual(tacticalFeedback(after,after),[]);
 after.units[0].hp-=5;assert.equal(contextualBanter(s,after,1),null);assert.match(contextualBanter(s,after,3).text,/herido|venda/i);
});
test('the initial tuning leaves a torso-hit survivor more next-turn AP and modestly improves distant accuracy',()=>{
 const s=field(),u=s.units[0],fired=actBattle(s,{type:'fire',unitId:u.id,targetId:'e',aim:2}),victim=fired.units[1];assert.equal(fired.lastError,null);assert.ok(victim.hp>=15);assert.ok(maxActionPoints(fired,victim)>0);
 const wounds=effectiveWounds(victim),oldBudget=Math.round(100-wounds/100*50-(100-victim.energy)*.25);assert.ok(maxActionPoints(fired,victim)>oldBudget,'the smaller wound penalty must provide actual action opportunity');
 assert.equal(actionCosts(fired,fired.units[0]).reload,45);assert.equal(COMBAT_BALANCE.firearmDamageMultiplier,1);assert.equal(COMBAT_BALANCE.woundAPMaximumPenalty,35);assert.ok(COMBAT_BALANCE.rangePenaltyMultiplier<1);
 const near=field(),far=field();far.units[1].x=12;assert.ok(shotChance(far,far.units[0],far.units[1],2)>0);assert.ok(shotChance(near,near.units[0],near.units[1],2)>=shotChance(far,far.units[0],far.units[1],2));
});
test('walking and preparation frames do not swing, and a cancelled attack has no strike pose',()=>{
 assert.equal(battleFramePose({type:'step',action:'melee'}),'idle');assert.equal(battleFramePose({type:'prepare',action:'melee'}),'idle');assert.equal(battleFramePose({type:'result',action:'melee',performed:false}),'idle');assert.equal(battleFramePose({type:'result',action:'melee'}),'strike');
 const s=field({weapon:1812}),result=presentedActBattle(s,{type:'charge',unitId:'p',targetId:'e'});assert.equal(result.state.lastError,null);assert.ok(result.frames.some(frame=>frame.action==='charge'&&battleFramePose(frame)==='strike'),'a completed charge must still show its strike');
});
test('an unarmed enemy can put away medical supplies through a legal free-hands order',()=>{
 const s=field();s.phase='enemy';const enemy=s.units[1];Object.assign(enemy,{weapon:0,blade:0,activeSlot:'medical',hp:100,bleeding:0,medkits:1,ap:100,loaded:0,ammo:0});
 const order=chooseEnemyAction(s,enemy);assert.deepEqual(order,{type:'weapon',unitId:enemy.id,slot:'unarmed'});
});
test('near misses and interrupts use the character contact line only on sparse events',()=>{
 const s=field({storyProfile:{speech:{contact:'A cubierto, compañeros.'}}}),near=structuredClone(s);near.units[1].lastTargetId='p';near.units[1].loaded=0;
 assert.equal(contextualBanter(s,near,1),null);assert.equal(contextualBanter(s,near,3).text,'A cubierto, compañeros.');
 const interrupt=structuredClone(s);interrupt.phase='interrupt';interrupt.interrupt={unitIds:['p']};assert.equal(contextualBanter(s,interrupt,1),null);assert.equal(contextualBanter(s,interrupt,3).text,'A cubierto, compañeros.');
});
test('a wounded mercenary can aim, fire, take opaque cover and complete a finite reload in one budget',()=>{
 const s=field({hp:39,maxHp:100,bandaged:0,energy:69,loaded:1,ammo:3});Object.assign(s.tiles.find(tile=>tile.x===2&&tile.y===3),{type:'wall',blocked:true,blocksSight:true});
 const budget=s.units[0].ap,oldBudget=Math.round(100-61/100*50-31*.25);assert.equal(budget,71);assert.ok(oldBudget<18+8+45);
 const fired=actBattle(s,{type:'fire',unitId:'p',targetId:'e',aim:1});assert.equal(fired.lastError,null);assert.equal(budget-fired.units[0].ap,18);assert.equal(fired.units[0].loaded,0);
 const covered=actBattle(fired,{type:'move',unitId:'p',x:1,y:3});assert.equal(covered.lastError,null);assert.equal(fired.units[0].ap-covered.units[0].ap,8);assert.equal(hasLineOfSight(covered,covered.units[1],covered.units[0]),false);
 const reloaded=actBattle(covered,{type:'reload',unitId:'p'});assert.equal(reloaded.lastError,null);assert.equal(covered.units[0].ap-reloaded.units[0].ap,45);assert.equal(reloaded.units[0].ap,0);assert.equal(reloaded.units[0].loaded,1);assert.equal(reloaded.units[0].ammo,2);assert.equal(reloaded.units[0].hp,39);assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(reloaded))));
});
test('an observed resident receives target focus and a real hit reaction in commanded playback',()=>{
 const s=createBattle([{id:'p',x:1,y:1,weapon:1805,loaded:1,marksmanship:100}],{width:12,height:8,seed:45,exploration:true,enemies:[],npcs:[{id:'resident',name:'Vecino',x:3,y:1}]});
 assert.equal(teamCanSee(s,'player',s.npcs[0]),true);
 const action={type:'fire',unitId:'p',targetId:'resident',targetKind:'npc'},result=presentedActBattle(s,action);assert.deepEqual(result.state,actBattle(s,action));assert.equal(result.state.lastError,null);
 const prepare=result.frames.find(frame=>frame.type==='prepare'),flight=result.frames.find(frame=>frame.type==='projectile'),impact=result.frames.find(frame=>frame.impacts.some(hit=>hit.unitId==='resident'));
 assert.ok(prepare&&flight&&impact);assert.equal(prepare.targetPoint.id,'resident');assert.equal(prepare.targetPoint.x,s.npcs[0].x);
 assert.ok(result.frames.indexOf(prepare)<result.frames.indexOf(flight));assert.ok(result.frames.indexOf(flight)<result.frames.indexOf(impact));
 assert.equal(flight.state.npcs[0].hp,s.npcs[0].hp);assert.deepEqual(flight.impacts,[]);assert.equal(flight.shotVisual.outcome,'hit');assert.ok(battleFrameDuration(flight)>=BATTLE_PLAYBACK.projectileMinimum);
 assert.equal(impact.type,'impact');assert.equal(impact.impacts[0].victimKind,'npc');assert.equal(impact.impacts[0].damage,s.npcs[0].hp-result.state.npcs[0].hp);assert.equal(impact.state.npcs[0].hp,result.state.npcs[0].hp);assert.equal(battleFrameDuration(impact),BATTLE_PLAYBACK.impact);
 for(const frame of [prepare,flight,impact]){const focus=battleFrameFocus(frame),targetX=frame===flight?flight.shotVisual.impact.x:s.npcs[0].x;assert.equal(focus.x,(s.units[0].x+targetX)/2);assert.equal(focus.y,1);assert.ok(!frame.visibleIds.includes('resident'),'the existing unit visibility list remains a unit list');}
});
