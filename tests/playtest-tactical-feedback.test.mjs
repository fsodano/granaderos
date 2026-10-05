import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,endTurn,getReachable,actionCosts,shotChance,maxActionPoints,hasLineOfSight,teamCanSee,getCareComposureResult} from '../game/tactical.js';
import {runBattleJob} from '../game/battle-job.js';
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
test('only new grief receipts show the named actual loss ahead of routine feedback',()=>{
 // These synthetic receipt fixtures test display only. The death transition
 // and physical witness admission are exercised by the core and mounted tests.
 const before=field();before.units[0].name='Inés Aguirre';
 before.units.push({...structuredClone(before.units[0]),id:'116',name:'Petrona Lagos'});
 const original=structuredClone(before);
 const after=structuredClone(before),speaker=after.units[0];after.units.at(-1).hp=0;
 speaker.companionGrief=[{companionId:116,loss:2}];speaker.jammed=true;speaker.trainedStats={marksmanship:1};
 const feedback=tacticalFeedback(before,after);
 assert.equal(feedback[0],'Inés Aguirre lamenta la muerte de Petrona Lagos. Moral −2.');
 assert.equal(feedback[1],'Inés Aguirre: Puntería +1');
 const restored=structuredClone(after);assert.deepEqual(tacticalFeedback(after,restored),[]);
 assert.deepEqual(tacticalFeedback(restored,restored),[]);
 const zero=structuredClone(after);zero.units[0].companionGrief[0].loss=0;
 assert.equal(tacticalFeedback(before,zero)[0],'Inés Aguirre lamenta la muerte de Petrona Lagos. Moral sin cambio.');
 const fractional=structuredClone(after);fractional.units[0].companionGrief[0].loss=2.5000000000000004;
 assert.equal(tacticalFeedback(before,fractional)[0],'Inés Aguirre lamenta la muerte de Petrona Lagos. Moral −2,5.');
 assert.equal(fractional.units[0].companionGrief[0].loss,2.5000000000000004,'display formatting preserves the exact receipt');
 fractional.units[0].companionGrief[0].loss=.001;
 assert.match(tacticalFeedback(before,fractional)[0],/Moral baja menos de 0,01/);
 const unadmitted=structuredClone(after);delete unadmitted.units[0].companionGrief;
 assert.equal(tacticalFeedback(before,unadmitted).some(text=>text.includes('Petrona Lagos')),false,'a raw HP transition cannot discover or name grief');
 const absent=structuredClone(after);absent.units=absent.units.filter(unit=>unit.id!=='116');
 assert.equal(tacticalFeedback(before,absent).some(text=>text.includes('Petrona Lagos')),false);
 assert.deepEqual(before,original,'reading the receipt cannot change the source');
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
test('actual close passages and interrupts use distinct optional lines on sparse events without contact fallback',()=>{
 // Initial bounded combat fixture: one affordable hostile discharge. The paid
 // integration separately proves issued native equipment and campaign custody.
 const s=createBattle([{id:'p',name:'Defensor',x:7,y:3,facing:6,weapon:1800,loaded:0,storyProfile:{speech:{contact:'Contacto nuevo.',near:'Esa bala pasó cerca.',interrupt:'Ahora puedo actuar.'}}}],{width:20,height:8,seed:3,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:1,y:3,facing:2,weapon:1800,marksmanship:42,loaded:1,ammo:0,condition:100,patrol:false,overwatch:false}]});
 s.units[0].ap=0;s.units[1].ap=12;
 const silent=endTurn(s);assert.equal(silent.units[0].hp,s.units[0].hp);assert.equal(silent.units[1].loaded,0);
 assert.equal(contextualBanter(s,silent,1),null);assert.equal(contextualBanter(s,silent,3),null,'a silent event is consumed, never backfilled');
 const near=endTurn(s);assert.equal(contextualBanter(s,near,3).text,'Esa bala pasó cerca.');assert.equal(contextualBanter(s,near,6),null);
 const invented=structuredClone(s);invented.units[1].lastTargetId='p';invented.units[1].loaded=0;assert.equal(contextualBanter(s,invented,3),null,'a charge delta cannot prove a close passage');
 const interrupt=structuredClone(s);interrupt.phase='interrupt';interrupt.interrupt={unitIds:['p']};assert.equal(contextualBanter(s,interrupt,1),null);assert.equal(contextualBanter(s,interrupt,3).text,'Ahora puedo actuar.');
 const omitted=structuredClone(s);delete omitted.units[0].storyProfile.speech.near;delete omitted.units[0].storyProfile.speech.interrupt;
 assert.equal(contextualBanter(omitted,endTurn(omitted),3),null);
 const oldInterrupt=structuredClone(omitted);oldInterrupt.phase='interrupt';oldInterrupt.interrupt={unitIds:['p']};assert.equal(contextualBanter(omitted,oldInterrupt,3),null);
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


test('care composure feedback is an actual action result and cannot be manufactured by worker or saved-state shock deltas',()=>{
 const before=createBattle([{id:'caregiver',name:'Sanitario',x:1,y:1,facing:2,activeSlot:'medical',medical:60,medkits:2,abilities:['care_composure'],shock:3},{id:'patient',name:'Herido',x:2,y:1,hp:30,bleeding:3,bandaged:0}],{width:8,height:8,seed:45,enemies:[{id:'enemy',x:7,y:7,patrol:false,overwatch:false}]});
 const action={type:'useItem',unitId:'caregiver',targetId:'patient'},ordinary=actBattle(before,action),presented=presentedActBattle(before,action);assert.equal(ordinary.lastError,null);assert.deepEqual(presented.state,ordinary);
 const expected={unitId:'caregiver',targetId:'patient',targetKind:'unit',relief:2};assert.deepEqual(getCareComposureResult(before,ordinary),expected);assert.deepEqual(getCareComposureResult(before,presented.state),expected);
 const changed=getCareComposureResult(before,ordinary);changed.relief=99;assert.deepEqual(getCareComposureResult(before,ordinary),expected,'reading or altering a returned result cannot alter the accepted event');
 assert.equal(getCareComposureResult(ordinary,ordinary),null);assert.equal(getCareComposureResult(before,structuredClone(ordinary)),null);assert.equal(getCareComposureResult(before,JSON.parse(JSON.stringify(ordinary))),null);
 const worker=structuredClone(runBattleJob({battle:before,action}));assert.deepEqual(worker,ordinary);assert.equal(getCareComposureResult(before,worker),null,'structured clone retains authoritative shock, never a fabricated presentation receipt');
 assert.equal(ordinary.units[0].shock,1);assert.equal(ordinary.units[0].medkits,1);assert.equal(ordinary.units[1].bleeding,0);assert.ok(!JSON.stringify(ordinary).includes('composureRelief'));assert.deepEqual(tacticalFeedback(before,worker),[],'generic feedback does not infer care from shock or dressing changes');
});
