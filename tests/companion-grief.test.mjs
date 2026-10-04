import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {deploymentMorale} from '../game/morale.js';
import {createBattle,actBattle,presentedActBattle,canSee,reloadPlan,reprimePlan,pointFirePreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {COMPANION_GRIEF_MORALE,captureCompanionGrief,applyCompanionGrief,validateCompanionGrief,validateCompanionGriefContext,addIssuedGriefParticipant} from '../game/companion-grief.js';
import {approachNPC} from './approach-npc.mjs';
import {secureArea} from './controlled-area-fixture.mjs';

const flat=(width=16,height=8)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
// Declared engine arena, not a campaign victory or issued equipment claim.
const scene=(witness={},companion={},extra=[],options={})=>createBattle([
 {id:107,name:'Inés',x:1,y:3,facing:2,griefCompanionIds:[116],weapon:1800,loaded:1,ammo:2,marksmanship:100,morale:80,...witness},
 {id:116,name:'Petrona',x:5,y:3,facing:6,hp:1,bleeding:1,...companion},...extra,{id:113,name:'Testigo sin preferencia',x:1,y:6,hp:100},
],{width:16,height:8,tiles:flat(),hour:12,seed:11,exploration:true,enemies:[],...options});
const actor=b=>b.units.find(u=>u.id==='107');
const buddy=b=>b.units.find(u=>u.id==='116');
const wait=b=>{let next=b;for(let i=0;i<12&&buddy(next).hp>0;i++){const action={type:'look',unitId:'113',x:2,y:i%2?7:6},before=next;next=actBattle(next,action);assert.equal(next.lastError,null);assert.deepEqual(presentedActBattle(before,action).state,next);}return next;};
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const pair=(content=defaultContentPackage())=>{let c=initialCampaign(42,content);for(const id of [107,116])c=order(c,{type:'recruitCivic',id,term:'week'});for(let i=0;i<6;i++)c=order(c,{type:'advanceStrategicTime',seconds:3600});c=order(c,{type:'renewContract',id:107,term:'day'});c=order(c,{type:'visitSector'});return {campaign:c,battle:enterSector(c.pendingBattle)};};
const saved=p=>decodeSave(encodeSave(p.campaign,p.battle));
const sync=p=>{const campaign=order(p.campaign,{type:'syncTacticalTime',battleId:p.campaign.pendingBattle.id,elapsedSeconds:p.battle.elapsedSeconds,sectorState:p.battle});return saved({campaign,battle:{...p.battle,syncedSeconds:p.battle.elapsedSeconds}});};
const lethalPair=()=>{let p=pair();const target=buddy(p.battle),actions=[{type:'firePoint',unitId:'107',x:target.x,y:target.y,aim:4},{type:'reload',unitId:'107'},{type:'firePoint',unitId:'107',x:target.x,y:target.y,aim:4}];for(const action of actions){p.battle=actBattle(p.battle,action);assert.equal(p.battle.lastError,null);}assert.equal(buddy(p.battle).hp,0);assert.deepEqual(actor(p.battle).companionGrief,[{companionId:116,loss:6}]);return p;};
const rejectsAtomically=(p,type='syncTacticalTime')=>{const action={type,battleId:p.campaign.pendingBattle.id,elapsedSeconds:p.battle.elapsedSeconds,sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')},before=structuredClone(p.campaign),next=dispatchCampaign(p.campaign,action);assert.ok(next.lastError);assert.deepEqual({...next,lastError:null},before);};

test('issue pins every directed preference even with zero support; old pinned definitions and pending contexts stay neutral',()=>{
 const content=defaultContentPackage(),def=content.characters.find(c=>c.id==='person-107');def.preferredCompanions.push({character:'person-103',reason:'Otra preferencia declarada.'},{character:'person-110',reason:'Una tercera preferencia declarada.'});
 const c=initialCampaign(42,content);c.operativeState[107].morale=100;
 const issue=deploymentMorale(c,107,[107,116]);assert.equal(issue.morale,100);assert.equal(issue.companionBonus,undefined);assert.deepEqual(issue.griefCompanionIds,[116,103,110]);
 const legacy=defaultContentPackage();for(const character of legacy.characters)delete character.preferredCompanions;
 assert.equal(deploymentMorale(initialCampaign(42,legacy),107,[107,116]).griefCompanionIds,undefined);
 const p=pair();delete p.campaign.pendingBattle.squad.find(u=>u.id===107).griefCompanionIds;delete actor(p.battle).griefCompanionIds;delete p.battle.griefParticipantIds;
 const restored=saved(p);assert.equal(actor(restored.battle).griefCompanionIds,undefined);assert.equal(restored.battle.griefParticipantIds,undefined);
});

test('the shared transition clips actual loss, preserves ownership, and records each directed companion at most once',()=>{
 assert.equal(COMPANION_GRIEF_MORALE,6);
 for(const morale of [0,2.5,6,100]){
  const b=scene({morale}),u=actor(b),v=buddy(b),inventory=structuredClone(u.inventory),seed=b.seed,ap=u.ap,hp=u.hp;
  const captured=captureCompanionGrief(b,v,()=>true);v.hp=0;
  assert.deepEqual(applyCompanionGrief(b,captured).map(r=>r.loss),[Math.min(6,morale)]);
  assert.equal(u.morale,Math.max(0,morale-6));assert.deepEqual(u.companionGrief,[{companionId:116,loss:Math.min(6,morale)}]);
  assert.deepEqual(applyCompanionGrief(b,captured),[]);assert.equal(captureCompanionGrief(b,v,()=>true),null);
  assert.deepEqual(u.inventory,inventory);assert.equal(u.hp,hp);assert.equal(u.ap,ap);assert.equal(b.seed,seed);
 }
 const b=scene({griefCompanionIds:[116,103,110],morale:80},{},[{id:103,x:4,y:2,hp:1,bleeding:1},{id:110,x:4,y:4,hp:1,bleeding:1}]);
 const next=wait(b);assert.equal(actor(next).morale,62);assert.deepEqual(actor(next).companionGrief,[{companionId:116,loss:6},{companionId:103,loss:6},{companionId:110,loss:6}]);
 assert.equal(next.units.find(u=>u.id==='110').companionGrief,undefined,'preferences are directed');
});

test('real wound death needs this capable witness, facing, smoke, distance and room observation before the transition',()=>{
 const clear=scene();assert.equal(canSee(clear,actor(clear),buddy(clear)),true);const next=wait(clear);assert.equal(buddy(next).hp,0);assert.equal(actor(next).morale,74,'bleeding does not acquire the physical generic -18');assert.deepEqual(actor(next).companionGrief,[{companionId:116,loss:6}]);
 const cases=[
  ()=>scene({facing:6}),()=>scene({}, {x:23},[],{width:24,tiles:flat(24,8)}),
  ()=>{const b=scene({}, {x:7});b.smoke=[{x:4,y:3,radius:4,turns:4}];return b;},
  ()=>{const b=scene();b.tiles.find(t=>t.x===3&&t.y===3).blocksSight=true;b.tiles.find(t=>t.x===3&&t.y===3).blocked=true;return b;},
  ()=>scene({}, {roomId:'unrevealed'}),
  ...[{asleep:true},{sleepCollapsed:true},{captured:true},{hp:14},{energy:0},{surrendered:true},{routed:true},{fled:true}].map(condition=>()=>scene(condition)),
 ];
 for(const [i,build]of cases.entries()){const b=build(),end=wait(b);assert.equal(buddy(end).hp,0);assert.equal(actor(end).companionGrief,undefined,`hidden/incapable case ${i}`);assert.equal(end.log.some(text=>text.includes('lamenta la muerte')),false);}
});

test('new grief only follows an initially positive participant; retained unissued critical bodies and corpses stay neutral',()=>{
 const positive=scene({}, {hp:1});assert.deepEqual(positive.griefParticipantIds,[107,116,113]);assert.deepEqual(actor(wait(positive)).companionGrief,[{companionId:116,loss:6}]);
 const dead=scene({}, {hp:0,bleeding:0});assert.deepEqual(dead.griefParticipantIds,[107,113]);assert.equal(actor(wait(dead)).companionGrief,undefined);
 const retained=scene();retained.units=retained.units.filter(u=>u.id!=='116');retained.griefParticipantIds=[107,113];
 retained.units.push(buddy(scene()));const end=wait(retained);assert.equal(buddy(end).hp,0);assert.equal(actor(end).companionGrief,undefined);
});

test('physical bodyguard redirection charges grief for the real deceased recipient, preserving the generic teammate penalty',()=>{
 const b=scene({griefCompanionIds:[116]}, {x:6,y:3,hp:26,bleeding:0,abilities:['bodyguard']},[{id:57,name:'Comandante',x:5,y:3,hp:100,abilities:['protected_commander']}]);
 const action={type:'firePoint',unitId:'107',x:5,y:3,aim:4},next=actBattle(b,action);assert.equal(next.lastError,null);assert.deepEqual(presentedActBattle(b,action).state,next);
 assert.equal(buddy(next).hp,0);assert.equal(next.units.find(u=>u.id==='57').hp,100);assert.equal(actor(next).morale,56);assert.deepEqual(actor(next).companionGrief,[{companionId:116,loss:6}]);assert.equal(actor(next).loaded,0);assert.equal(next.elapsedSeconds,3);
 const commanderPreference=scene({griefCompanionIds:[57]}, {x:6,y:3,hp:26,bleeding:0,abilities:['bodyguard']},[{id:57,x:5,y:3,hp:100,abilities:['protected_commander']}]);const other=actBattle(commanderPreference,action);assert.equal(other.lastError,null);assert.equal(buddy(other).hp,0);assert.equal(actor(other).companionGrief,undefined);assert.equal(actor(other).morale,62);
});

test('receipt structure is bounded, typed and military-only without changing old absent records',()=>{
 assert.doesNotThrow(()=>validateCompanionGrief({id:'107'}));
 for(const fields of [{griefCompanionIds:null},{griefCompanionIds:[116,116]},{griefCompanionIds:['116']},{griefCompanionIds:[107]},{griefCompanionIds:[1,2,3,4]},
  {companionGrief:null},{companionGrief:[{companionId:'116',loss:6}]},{companionGrief:[{companionId:116,loss:7}]},{companionGrief:[{companionId:116,loss:-1}]},{companionGrief:[{companionId:116,loss:null}]},{companionGrief:[{companionId:116,loss:6,turn:1}]},{companionGrief:[{companionId:116,loss:6},{companionId:116,loss:6}]}])assert.throws(()=>validateCompanionGrief({id:'107',...fields}),/duelo/);
 const b=scene();for(const change of [x=>x.units[0].side='enemy',x=>x.units[0].militia=true,x=>x.units[0].id='resident',x=>x.griefParticipantIds=[107,107],x=>x.griefParticipantIds=[107,'116']]){const invalid=structuredClone(b);change(invalid);assert.throws(()=>validateBattleSnapshot(invalid),/duelo/);}
 const npc=scene();npc.npcs=[{id:'n',name:'Residente',x:8,y:5,hp:100,companionGrief:[]}];assert.throws(()=>validateBattleSnapshot(npc),/duelo/);
 for(const key of ['griefCompanionIds','griefParticipantIds']){const b=scene(),sparse=new Array(1);sparse.extra=116;(key==='griefCompanionIds'?actor(b):b)[key]=sparse;assert.throws(()=>validateBattleSnapshot(b),/duelo/);}
 const missing=scene();delete missing.griefParticipantIds;assert.throws(()=>validateBattleSnapshot(missing),/duelo/);
 const absent=scene();absent.griefParticipantIds.push(103);assert.throws(()=>validateBattleSnapshot(absent),/duelo/);
});

test('a neutral reentry strips only obsolete issue metadata from retained and transported bodies',()=>{
 const old=createBattle([{id:107,name:'Inés',x:10,y:3,hp:0,griefCompanionIds:[116],companionGrief:[{companionId:116,loss:6}]}],{id:'prior',sector:'retiro',exploration:true,enemies:[]});old.sectorCleared=true;
 const request={id:'new-visit',sector:'retiro',hour:12,seed:11,exploration:true,squad:[{id:110,hp:100}],enemies:[]},next=enterSector(request,old),body=next.units.find(u=>u.id==='107');
 assert.equal(next.griefParticipantIds,undefined);assert.equal(body.griefCompanionIds,undefined);assert.deepEqual(body.companionGrief,[{companionId:116,loss:6}]);assert.deepEqual(old.units[0].griefCompanionIds,[116]);assert.doesNotThrow(()=>validateBattleSnapshot(next));
 const queued=enterSector({...request,remains:[{battleId:'prior',unitId:'107',unit:old.units[0],entryEdge:'N',entryAnchor:{x:1,y:0}}]}),carried=queued.units.find(u=>u.id==='107');assert.equal(carried.griefCompanionIds,undefined);assert.deepEqual(carried.companionGrief,body.companionGrief);assert.doesNotThrow(()=>validateBattleSnapshot(queued));
});

test('active, raw return and resumed snapshots reject missing issue context, false deaths and receipt edits atomically',()=>{
 const p=lethalPair();
 const pendingResume=structuredClone(p);pendingResume.campaign.pendingBattle.resumeSnapshot=structuredClone(p.battle);delete actor(pendingResume.battle).companionGrief;assert.throws(()=>saved(pendingResume));rejectsAtomically(pendingResume);rejectsAtomically(pendingResume,'leaveSector');
 const resumed=order(p.campaign,{type:'syncTacticalTime',battleId:p.campaign.pendingBattle.id,elapsedSeconds:p.battle.elapsedSeconds});resumed.pendingBattle.resumeSnapshot=structuredClone({...p.battle,syncedSeconds:p.battle.elapsedSeconds});const admitted=saved({campaign:resumed,battle:resumed.pendingBattle.resumeSnapshot}),clockOnly=order(admitted.campaign,{type:'syncTacticalTime',battleId:resumed.pendingBattle.id,elapsedSeconds:p.battle.elapsedSeconds});assert.equal(clockOnly.pendingBattle.resumeSnapshot,undefined);assert.deepEqual(clockOnly.pendingBattle.squad.find(u=>u.id===107).companionGrief,[{companionId:116,loss:6}]);const resetClock={campaign:clockOnly,battle:structuredClone(admitted.battle)};delete actor(resetClock.battle).companionGrief;assert.throws(()=>saved(resetClock));rejectsAtomically(resetClock);
 for(const change of [x=>delete x.battle.griefParticipantIds,x=>x.battle.griefParticipantIds=[107],x=>delete actor(x.battle).griefCompanionIds,x=>actor(x.battle).griefCompanionIds=[103],x=>actor(x.battle).companionGrief[0].companionId=103,
  x=>{const u=buddy(x.battle);u.hp=1;u.unconscious=true;},x=>{buddy(x.battle).side='enemy';},x=>{buddy(x.battle).id='missing';},x=>{x.campaign.pendingBattle.squad.find(u=>u.id===116).hp=0;}]){
  const invalid=structuredClone(p);change(invalid);assert.throws(()=>saved(invalid));rejectsAtomically(invalid);rejectsAtomically(invalid,'leaveSector');
  const resume=structuredClone(invalid.campaign);resume.pendingBattle.resumeSnapshot=structuredClone(invalid.battle);assert.throws(()=>decodeSave(encodeSave(resume,invalid.battle)));
 }
 const valid=saved(sync(p));assert.equal(valid.campaign.operativeState[107].companionGrief,undefined,'pending tactical grief is not yet personal');
 const issued=valid.campaign.pendingBattle.squad.find(u=>u.id===107);assert.equal(issued.hp,p.campaign.pendingBattle.squad.find(u=>u.id===107).hp);assert.equal(issued.morale,85);assert.equal(issued.companionBonus,3);assert.deepEqual(issued.companionGrief,[{companionId:116,loss:6}]);
 for(const change of [u=>delete u.companionGrief,u=>u.companionGrief=[],u=>u.companionGrief[0].loss=5]){const reset=structuredClone(valid);change(actor(reset.battle));assert.throws(()=>saved(reset));rejectsAtomically(reset);rejectsAtomically(reset,'leaveSector');const resume=structuredClone(reset.campaign);resume.pendingBattle.resumeSnapshot=reset.battle;assert.throws(()=>decodeSave(encodeSave(resume,reset.battle)));}
 const returned=order(valid.campaign,{type:'leaveSector',battleId:valid.campaign.pendingBattle.id,sectorState:valid.battle,survivors:valid.battle.units.filter(u=>u.side==='player')});assert.deepEqual(returned.operativeState[107].companionGrief,[{companionId:116,loss:6}]);assert.doesNotThrow(()=>decodeSave(encodeSave(returned)));
 const reset=structuredClone(returned);delete reset.operativeState[107].companionGrief;assert.throws(()=>decodeSave(encodeSave(reset)),/duelo/);
 const edited=structuredClone(returned);edited.operativeState[107].companionGrief[0].loss=5;assert.throws(()=>decodeSave(encodeSave(edited)),/duelo/);
 // A personal receipt stays valid when its deceased target is absent from a
 // later declared issued scene; only new tactical receipts require its body.
 const request={squad:[{...returned.operativeState[107],id:107,hp:returned.operativeState[107].hp,griefCompanionIds:[116]}]},later=createBattle(request.squad,{tiles:flat(),width:16,height:8,exploration:true,enemies:[]});assert.doesNotThrow(()=>validateCompanionGriefContext(returned,later,rosterFor(returned),request));
});

test('actual local Cabral recruitment extends issued membership without late support, new preferences or old-context backfill',()=>{
 let p=pair();p.battle=approachNPC(p.battle,'107','cabral');p=sync(p);const before=structuredClone(actor(p.battle)),cash=p.campaign.resources.treasury,source=p.battle.npcs.find(n=>n.id==='cabral');
 p.campaign=order(p.campaign,{type:'talkNPC',npcId:'cabral',unitId:107,approach:'recruit',sectorState:p.battle});assert.equal(p.campaign.lastConversation.outcome,'recruited');assert.equal(p.campaign.resources.treasury,cash);
 const record=p.campaign.pendingBattle.squad.find(u=>u.id===3),unit={...createBattle([record],{width:p.battle.width,height:p.battle.height,enemies:[],exploration:true}).units[0],x:source.x,y:source.y};p.battle.npcs=p.battle.npcs.filter(n=>n.id!=='cabral');p.battle.units.push(unit);
 assert.throws(()=>saved(p),'unpublished added member is incomplete context');addIssuedGriefParticipant(p.battle,unit);assert.deepEqual(p.battle.griefParticipantIds,[107,116,3]);addIssuedGriefParticipant(p.battle,unit);assert.deepEqual(p.battle.griefParticipantIds,[107,116,3]);assert.deepEqual(actor(p.battle),before);assert.equal(unit.griefCompanionIds,undefined);assert.equal(unit.companionBonus,undefined);
 assert.throws(()=>addIssuedGriefParticipant(p.battle,{...unit}),/duelo/);const older=structuredClone(p.battle);delete older.griefParticipantIds;assert.equal(addIssuedGriefParticipant(older,older.units.find(u=>u.id==='3')).griefParticipantIds,undefined);
 p=sync(p);assert.deepEqual(saved(p),p);const returned=order(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});assert.ok(returned.recruited.includes(3));assert.equal(returned.operativeState[107].morale,82);assert.equal(returned.operativeState[3].companionGrief,undefined);assert.doesNotThrow(()=>decodeSave(encodeSave(returned)));
});

test('an authored preference for the issued mission ally survives his real death, mirror, saved sync and defeat return',()=>{
 const content=defaultContentPackage();content.characters.find(c=>c.id==='person-107').preferredCompanions=[{character:'person-57',reason:'Preferencia ficticia de este escenario.'}];let p=pair(content);
 let c=order(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});
 // A declared established campaign milestone isolates the existing auxiliary
 // return path. No gear, money, HP, RNG or tactical outcome is granted.
 c=secureArea(c,'buenos_aires','san_nicolas');c.phase=1;c.flags.academy=true;c=order(c,{type:'travel',sector:'san_nicolas'});c=order(c,{type:'attack',sector:'san_lorenzo'});const request=c.pendingBattle;
 let b=createBattle([...request.squad.map((u,i)=>({...u,x:1,y:3+i*3})),...request.missionAllies.map(u=>({...u,x:4,y:3}))],{...request,width:48,height:16,tiles:flat(48,16),npcs:request.npcs.map((n,i)=>({...n,x:20+i,y:12})),props:[],enemies:request.enemies.map((u,i)=>({...u,x:40+i%6,y:3+Math.floor(i/6)})),deferContact:true});
 p=sync({campaign:c,battle:b});assert.ok(p.battle.griefParticipantIds.includes(57));assert.equal(p.campaign.operativeState[57].alive,true);
 for(let i=0;i<40&&p.battle.units.find(u=>u.id==='57').hp>0;i++){
  const u=actor(p.battle),fire={type:'firePoint',unitId:'107',x:4,y:3,aim:4};
  const action=u.jammed?(u.ap>=reprimePlan(u,p.battle).pa?{type:'reprime',unitId:'107'}:{type:'rest'}):
   u.loaded===0?(reloadPlan(u,p.battle).pa>0?{type:'reload',unitId:'107'}:{type:'rest'}):
   pointFirePreview(p.battle,u,fire,4).valid?fire:{type:'rest'};
  const next=actBattle(p.battle,action);assert.equal(next.lastError,null);assert.deepEqual(presentedActBattle(p.battle,action).state,next);p=sync({campaign:p.campaign,battle:next});
 }
 assert.equal(p.battle.units.find(u=>u.id==='57').hp,0);assert.deepEqual(actor(p.battle).companionGrief,[{companionId:57,loss:6}]);assert.equal(p.campaign.operativeState[57].hp,0);assert.equal(p.campaign.operativeState[57].alive,false);assert.deepEqual(saved(p),p);
 c=order(p.campaign,{type:'battleResult',battleId:request.id,outcome:'defeat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});assert.equal(c.defeated,true);assert.equal(c.missionAllies.san_lorenzo.hp,0);assert.deepEqual(c.operativeState[107].companionGrief,[{companionId:57,loss:6}]);assert.doesNotThrow(()=>decodeSave(encodeSave(c)));
});
