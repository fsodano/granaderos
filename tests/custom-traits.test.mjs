import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,getReachable,actionCosts,ignitionRisk,shotChance,firearmFlightPreview,teamCanSee} from '../game/tactical.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {battleFrameDuration,battleFrameFocus} from '../game/battle-playback.js';
const tiles=()=>Array.from({length:80},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,cover:0}));
function battlefield(traits=[],extra={}){return createBattle([{id:1000,name:'Oficial del Cabildo',weapon:1800,x:1,y:1,horse:true,traits,...extra}],{width:10,height:8,tiles:tiles(),enemies:[{id:'enemy',x:7,y:1}],seed:45});}
test('cavalry doctrine saves enough AP to mount, advance and fight beyond ordinary budget',()=>{const normal=actBattle(battlefield(),{type:'mount',unitId:1000}),trained=actBattle(battlefield(['cavalry_commander']),{type:'mount',unitId:1000});assert.ok(trained.units[0].ap>normal.units[0].ap);const travel=b=>getReachable(b,'1000').find(t=>t.x===4&&t.y===1).cost;assert.ok(travel(trained)<travel(normal));assert.ok(actionCosts(trained,trained.units[0]).fire<actionCosts(normal,normal.units[0]).fire);assert.ok(actionCosts(trained,trained.units[0]).melee<actionCosts(normal,normal.units[0]).melee);});
test('guerrilla doctrine improves broken-ground endurance, concealment and ambush',()=>{const b=battlefield(['guerrilla_tactician'],{fatigue:60});b.tiles.find(t=>t.x===1&&t.y===1).type='forest';b.tiles.find(t=>t.x===2&&t.y===1).type='stone';const ordinary=structuredClone(b);ordinary.units[0].traits=[];assert.ok(getReachable(b,'1000').find(t=>t.x===2&&t.y===1).cost<getReachable(ordinary,'1000').find(t=>t.x===2&&t.y===1).cost);assert.ok(shotChance(b,b.units[0],b.units[1])>shotChance(ordinary,ordinary.units[0],ordinary.units[1]));assert.ok(shotChance(b,b.units[1],b.units[0])<shotChance(ordinary,ordinary.units[1],ordinary.units[0]));assert.ok(b.units[0].ap>battlefield([],{fatigue:60}).units[0].ap);});
test('guerrilla defense uses the occupied roof, ignores unseen ground and preserves a paid shot and official replay',t=>{
 let campaign=initialCampaign(45);
 const quote=contractQuote(campaign,rosterFor(campaign).find(unit=>unit.id===110),'week');
 for(const action of [{type:'recruitCivic',id:110,term:'week'},{type:'wait',hours:6},{type:'visitSector'}]){
  campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,campaign.lastError);
 }
 assert.equal(campaign.contracts[110].paid,quote.price);assert.equal(campaign.resources.treasury,3200-quote.price);
 const request=campaign.pendingBattle,initialContracts=structuredClone(campaign.contracts);
 const saved=(c,b)=>decodeSave(encodeSave(c,b));
 // Declared initial roof arena and finite defender kit. Acosta keeps his actual
 // paid health, skills and issued equipment. This is not a Retiro conquest.
 const arena=(ground={},roofCover=0,traits=['guerrilla_tactician'])=>{
  const width=16,height=10;
  const terrain=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0,...(i===88?ground:{})}));
  const upperSurfaces=Array.from({length:45},(_,i)=>({id:`roof:${i}`,x:3+i%9,y:3+Math.floor(i/9),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:3+i%9===8&&3+Math.floor(i/9)===5?roofCover:0}));
  const battle=createBattle(request.squad.map(unit=>({...unit,x:5,y:5,tacticalLevel:1,facing:2})),{
   ...request,width,height,tiles:terrain,upperSurfaces,props:[],
   npcs:request.npcs.map((npc,i)=>({...npc,x:2+i,y:9})),
   enemies:[{id:'roof-defender',name:'Defensor de la prueba',x:8,y:5,tacticalLevel:1,weapon:1800,loaded:1,ammo:9,traits,patrol:false,overwatch:false}],
  });
  if(request.finiteArtilleryArsenal)battle.finiteArtilleryArsenal=structuredClone(request.finiteArtilleryArsenal);
  return saved(campaign,battle);
 };
 const shooter=b=>b.units.find(unit=>unit.side==='player'),defender=b=>b.units.find(unit=>unit.id==='roof-defender');
 const chance=pair=>shotChance(pair.battle,shooter(pair.battle),defender(pair.battle));
 const path=pair=>firearmFlightPreview(pair.battle,shooter(pair.battle),defender(pair.battle));
 const action={type:'fire',unitId:'110',targetId:'roof-defender'};
 const publicFrames=result=>result.frames.map(frame=>({type:frame.type,unitId:frame.unitId,action:frame.action,visibleIds:frame.visibleIds,targetPoint:frame.targetPoint,shotVisual:frame.shotVisual,impacts:frame.impacts,duration:battleFrameDuration(frame),focus:battleFrameFocus(frame)}));
 const fire=pair=>{
  const before=structuredClone(pair),ordinary=actBattle(pair.battle,action),presented=presentedActBattle(pair.battle,action);
  assert.equal(ordinary.lastError,null,ordinary.lastError);assert.deepEqual(presented.state,ordinary);assert.deepEqual(pair,before);
  const cost=actionCosts(pair.battle,shooter(pair.battle),defender(pair.battle)).fire;
  assert.equal(shooter(ordinary).ap,shooter(pair.battle).ap-cost);
  assert.equal(shooter(ordinary).loaded,0);assert.equal(shooter(ordinary).ammo,shooter(pair.battle).ammo);
  assert.equal(shooter(ordinary).condition,shooter(pair.battle).condition-1);assert.equal(ordinary.elapsedSeconds,6);
  assert.ok(defender(ordinary).hp<defender(pair.battle).hp,'the representative seed produces an actual injury');
  const synced=syncBattleTime(pair.campaign,ordinary);assert.equal(synced.error,null,synced.error);
  const completed=saved(synced.campaign,synced.battle),reloaded=saved(pair.campaign,pair.battle);
  const replayed=syncBattleTime(reloaded.campaign,actBattle(reloaded.battle,action));assert.equal(replayed.error,null,replayed.error);
  assert.deepEqual(saved(replayed.campaign,replayed.battle),completed,'official initial-save replay preserves the entire result');
  assert.deepEqual(completed.battle,synced.battle);assert.deepEqual(completed.campaign.contracts,initialContracts);
  assert.equal(completed.campaign.resources.treasury,campaign.resources.treasury);
  return {ordinary,presented,completed,cost};
 };
 const exposed=arena(),plain=arena({},0,[]),reference=fire(exposed);
 assert.equal(chance(exposed),chance(plain),'an exposed roof supplies no defensive specialty bonus');
 assert.ok(teamCanSee(exposed.battle,'player',defender(exposed.battle)));
 assert.equal(teamCanSee(exposed.battle,'player',{x:8,y:5,tacticalLevel:0}),false,'the ground beneath the target is not observed');
 for(const ground of [{cover:20},{cover:100},{type:'forest'},{type:'scrub'}]){
  const pair=arena(ground),result=fire(pair);
  assert.equal(chance(pair),chance(exposed));assert.deepEqual(path(pair),path(exposed));
  assert.deepEqual(result.ordinary.units,reference.ordinary.units);assert.equal(result.ordinary.seed,reference.ordinary.seed);
  assert.deepEqual(publicFrames(result.presented),publicFrames(reference.presented),'unseen ground cannot change public shot cues or timing');
 }
 const covered=arena({},20),untrained=arena({},20,[]);
 assert.deepEqual(path(covered),path(untrained),'the trait changes accuracy without changing physical cover');
 assert.equal(chance(covered),chance(untrained)-12,'actual roof cover earns the existing twelve-point defense bonus');
 fire(covered);
 t.diagnostic(JSON.stringify({scenario:'declared roof arena, real paid native Acosta; not a conquest',hirePrice:quote.price,treasury:campaign.resources.treasury,exposedChance:chance(exposed),coveredChance:chance(covered),untrainedCoveredChance:chance(untrained),shotAP:reference.cost,shotSeconds:reference.ordinary.elapsedSeconds,roundsBefore:shooter(exposed.battle).loaded+shooter(exposed.battle).ammo,roundsAfter:shooter(reference.ordinary).loaded+shooter(reference.ordinary).ammo,defenderHP:defender(reference.ordinary).hp,finalSeed:reference.ordinary.seed}));
});
test('gunsmith reloads within a tight budget, primes faster and reduces real rain failure risk',()=>{let b=battlefield(['gunsmith_artillerist'],{loaded:0});b.weather.rain=70;b.units[0].ap=40;assert.ok(ignitionRisk(b,b.units[0])<ignitionRisk(b,{...b.units[0],traits:[]}));b=actBattle(b,{type:'reload',unitId:1000});assert.equal(b.lastError,null);assert.equal(b.units[0].loaded,1);assert.equal(b.units[0].ammo,11);assert.equal(b.units[0].priming,undefined);b.units[0].jammed=true;b.units[0].ap=10;b=actBattle(b,{type:'reprime',unitId:1000});assert.equal(b.lastError,null);assert.equal(b.units[0].jammed,false);assert.equal(b.units[0].priming,undefined);assert.equal(b.units[0].loaded,1);});
test('line marksman can afford an aimed shot and loses less accuracy in powder smoke',()=>{const b=battlefield(['line_marksman']);b.smoke=[{x:4,y:1,radius:1,turns:3}];const u=b.units[0],ordinary={...u,traits:[]};assert.ok(actionCosts(b,u).aim<actionCosts(b,ordinary).aim);assert.ok(shotChance(b,u,b.units[1],2)>shotChance(b,ordinary,b.units[1],2));b.units[0].ap=20;const n=actBattle(b,{type:'fire',unitId:1000,targetId:'enemy',aim:2});assert.equal(n.lastError,null);assert.ok(n.units[0].ap>=0);const plain=structuredClone(b);plain.units[0].traits=[];assert.ok(actBattle(plain,{type:'fire',unitId:1000,targetId:'enemy',aim:2}).lastError);});
test('field maintenance spends finite tools and improves the actual ignition risk',()=>{const b=battlefield(['gunsmith_artillerist'],{condition:40,toolkitPoints:60,flints:0});const before=ignitionRisk(b,b.units[0]);const n=actBattle(b,{type:'repair',unitId:1000});assert.equal(n.lastError,null);assert.equal(n.units[0].flints,undefined);assert.equal(n.units[0].condition,85);assert.equal(n.units[0].toolkitPoints,15);assert.ok(ignitionRisk(n,n.units[0])<before);assert.equal(n.units[0].loaded,b.units[0].loaded);const done=actBattle(n,{type:'repair',unitId:1000});assert.equal(done.lastError,null);assert.equal(done.units[0].condition,100);assert.equal(done.units[0].toolkitPoints,0);assert.ok(done.units[0].ap<n.units[0].ap);assert.ok(actBattle(done,{type:'repair',unitId:1000}).lastError);});
test('ignition kit is implicit and held rations restore energy without bandaging wounds or granting AP',()=>{const dry=battlefield([],{jammed:true,priming:0});assert.equal(actBattle(dry,{type:'reprime',unitId:1000}).lastError,null);const b=battlefield([],{fatigue:60,hp:50,bleeding:4,activeSlot:'supply',activeSupply:'rations'});b.units[0].ap=30;const n=actBattle(b,{type:'ration',unitId:1000});assert.equal(n.lastError,null);assert.equal(n.units[0].rations,1);assert.equal(n.units[0].bleeding,4);assert.equal(n.units[0].hp,50);assert.ok(n.units[0].fatigue<60);assert.equal(n.units[0].ap,20);});
test('cavalry commander keeps an adjacent mounted ally from routing under fire',()=>{const make=traits=>createBattle([{id:'shot',x:1,y:1,marksmanship:100,weapon:1800}],{width:10,height:8,tiles:tiles(),enemies:[{id:'rider',x:4,y:1,mounted:true,morale:16},{id:1000,x:4,y:2,traits}],seed:45});const command=actBattle(make(['cavalry_commander']),{type:'fire',unitId:'shot',targetId:'rider'});assert.equal(command.units[1].routed,false);assert.ok(command.units[1].morale>=20);const ordinary=actBattle(make([]),{type:'fire',unitId:'shot',targetId:'rider'});assert.equal(ordinary.units[1].routed,true);});
