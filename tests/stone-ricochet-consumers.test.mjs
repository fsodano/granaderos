import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,presentedActBattle,actionCosts,weaponFor,firearmFlightPreview,firearmVolleyPreview,firearmKnownTerrain,teamCanSee} from '../game/tactical.js';
import {projectileFlight} from '../game/projectile-cover.js';
import {firearmBystanderRisk} from '../game/firearm-bystander-risk.js';
import {practiceFirearmNearMiss} from '../game/firearm-near-miss-practice.js';
import {targetPreview} from '../game/ja2-hud.js';
import {battleFrameDuration,battleFrameFocus} from '../game/battle-playback.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {captureBattlePresentation,recordBattleFrame} from '../game/battle-presentation.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');

// Isolated finite firing fixtures, not a fresh campaign win. The separate paid
// integration retains real hiring, issued equipment, official saves and return.
const tiles=(width,height)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,blocksSight:false,cover:0}));
const actor=(s,id='p')=>s.units.find(unit=>unit.id===id);
const point={x:10,y:5,tacticalLevel:0,stance:'standing'};
const action={type:'firePoint',unitId:'p',x:point.x,y:point.y,aim:4};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
const saved=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
const publicFrame=frame=>({type:frame.type,action:frame.action,unitId:frame.unitId,visibleIds:frame.visibleIds,impacts:frame.impacts,targetPoint:frame.targetPoint,shotVisual:frame.shotVisual,duration:battleFrameDuration(frame),focus:battleFrameFocus(frame)});
function field(extra={}){
 const s=createBattle([{id:'p',name:'Tirador',x:1,y:3,facing:2,weapon:1805,loaded:1,ammo:9,condition:100,marksmanship:100}],{width:32,height:16,seed:8,tiles:tiles(32,16),weather:{rain:0,humidity:0},enemies:[{id:'e',name:'Enemigo observado',x:12,y:4,patrol:false,overwatch:false}],...extra});
 Object.assign(s.tiles.find(tile=>tile.x===8&&tile.y===5),{type:'wall',material:'stone',blocked:true,blocksSight:true});return s;
}
function shoot(s,order=action){
 const before=structuredClone(s),ordinary=actBattle(s,order),shown=presentedActBattle(s,order);
 assert.equal(ordinary.lastError,null,ordinary.lastError);assert.deepEqual(shown.state,ordinary);assert.deepEqual(s,before);
 assert.deepEqual(actBattle(saved(s),order),ordinary);assert.deepEqual(saved(ordinary),ordinary);return {ordinary,shown};
}
const flights=result=>result.shown.frames.filter(frame=>frame.type==='projectile'&&frame.shotVisual);

test('a known stone reflection warns about an off-axis ally and does not promise the original selected body',()=>{
 const s=field(),u=actor(s),target=actor(s,'e');Object.assign(target,{x:10,y:5});
 // This declared stone cover permits sight, as existing cover fixtures do;
 // the selected enemy can therefore use the ordinary named-target control.
 s.tiles.find(tile=>tile.x===8&&tile.y===5).blocksSight=false;
 s.units.push({...structuredClone(u),id:'ally',name:'Aliado tras el rebote',x:12,y:4});
 const before=structuredClone(s),flight=firearmFlightPreview(s,u,target),impact=flight.bodyImpacts.find(entry=>entry.victimId==='ally');
 assert.ok(impact);assert.equal(impact.segmentIndex,1);assert.equal(impact.hitLocation,'torso');close(impact.incomingImpact,weaponFor(u).damage/2);
 const chordY=u.y+(target.y-u.y)*(12-u.x)/(target.x-u.x);assert.ok(Math.abs(chordY-4)>.5,'the friend is outside the original ray cell');
 const risk=firearmBystanderRisk(s,u,target);assert.ok(risk.direct.some(body=>body.id==='ally'));
 const forecast=firearmVolleyPreview(s,u,target,4).shots[0];assert.equal(forecast.chance,0);assert.equal(forecast.damageFactor,0);assert.equal(forecast.interveningFriendly,true);
 const hud=targetPreview(s,u,target,{mode:'fire',aim:4});assert.equal(hud.valid,true);assert.match(hud.coverNote,/Riesgo de rebote en piedra/);assert.match(hud.coverNote,/Aliado tras el rebote/);assert.doesNotMatch(hud.coverNote,/La cobertura detiene este tiro/);
 assert.deepEqual(s,before,'forecast and risk do not draw RNG or consume equipment');
 // The second finite loaded pistol is declared before this read-only preview.
 // A deflected path may continue even though neither gun reaches the target.
 const paired=structuredClone(s);actor(paired).offHand={weapon:1808,count:1,loaded:1,condition:100,weight:1.3};
 const pairedBefore=structuredClone(paired),pairedVolley=firearmVolleyPreview(paired,actor(paired),actor(paired,'e'),4),pairedHud=targetPreview(paired,actor(paired),actor(paired,'e'),{mode:'fire',aim:4});
 assert.equal(pairedVolley.paired,true);assert.deepEqual(pairedVolley.shots.map(shot=>shot.chance),[0,0]);
 assert.match(pairedHud.coverNote,/Mano principal: 0% \(sin impacto previsto en el blanco\)/);assert.match(pairedHud.coverNote,/Segunda mano: 0% \(sin impacto previsto en el blanco\)/);
 assert.match(pairedHud.coverNote,/Riesgo de rebote en piedra/);assert.match(pairedHud.coverNote,/Aliado tras el rebote/);assert.doesNotMatch(pairedHud.coverNote,/la cobertura detiene el tiro/i);assert.deepEqual(paired,pairedBefore);
});

test('a visible native stone edge includes an ally hit only on the reflected leg in direct warnings',()=>{
 const s=field(),u=actor(s),target=actor(s,'e');Object.assign(target,{x:10,y:5});
 Object.assign(s.tiles.find(tile=>tile.x===8&&tile.y===5),{type:'grass',material:undefined,blocked:false,blocksSight:false});
 s.wallEdges=[{id:'native-stone',x:7,y:5,axis:'x',type:'wall',material:'stone',blocked:true,blocksSight:false,cover:100}];
 s.units.push({...structuredClone(u),id:'ally',name:'Aliado tras el rebote',x:12,y:4});
 const before=structuredClone(s),flight=firearmFlightPreview(s,u,target),impact=flight.bodyImpacts.find(entry=>entry.victimId==='ally');
 assert.equal(teamCanSee(s,'player',s.wallEdges[0]),true);assert.ok(impact);assert.equal(impact.segmentIndex,1);
 assert.ok(Math.abs(u.y+(target.y-u.y)*(12-u.x)/(target.x-u.x)-4)>.5);
 const risk=firearmBystanderRisk(s,u,target);assert.ok(risk.direct.some(body=>body.id==='ally'));
 assert.match(targetPreview(s,u,target,{mode:'fire',aim:4}).coverNote,/Personas en la trayectoria: Aliado tras el rebote/);assert.deepEqual(s,before);
 const hidden=structuredClone(s);actor(hidden).facing=6;actor(hidden,'ally').facing=2;
 const clear=structuredClone(hidden);clear.wallEdges=[];
 assert.equal(teamCanSee(hidden,'player',hidden.wallEdges[0]),false);
 assert.deepEqual(firearmBystanderRisk(hidden,actor(hidden),actor(hidden,'e')),firearmBystanderRisk(clear,actor(clear),actor(clear,'e')),'unobserved stone cannot create a public reflection warning');
});

test('hidden bodies and stone furniture cannot alter complete public reflected flight, timing or camera',()=>{
 const clear=field(),stone=clear.tiles.find(tile=>tile.x===8&&tile.y===5);
 assert.equal(teamCanSee(clear,'player',stone),true,'the actual opaque stone face is observed');
 assert.equal(teamCanSee(clear,'player',{x:stone.x,y:stone.y}),false,'a generic point cannot grant sight through that stone');
 const normal=shoot(clear),normalFlight=flights(normal).map(publicFrame);assert.equal(normalFlight.length,2);assert.ok(actor(normal.ordinary,'e').hp<100);
 assert.deepEqual(normalFlight[0].shotVisual.impact,firearmFlightPreview(clear,actor(clear),point).ricochets[0].impact,'the observed stone face supplies the exact public reflected leg');
 for(const kind of ['body','stone','stone-adjacent']){
  const hidden=field();
  if(kind==='body')hidden.npcs=[{id:'private-body',name:'Nombre privado',x:6,y:4,hp:100,stance:'standing',roomId:'unrevealed'}];
  else hidden.props=[{id:'private-stone',type:'barrels',x:kind==='stone-adjacent'?8:3,y:4,material:'stone',obstacleHeight:2,blocksSight:false,blocksMovement:false,roomId:'unrevealed'}];
  assert.deepEqual(firearmVolleyPreview(hidden,actor(hidden),actor(hidden,'e'),4),firearmVolleyPreview(clear,actor(clear),actor(clear,'e'),4));
  assert.deepEqual(firearmBystanderRisk(hidden,actor(hidden),actor(hidden,'e')),firearmBystanderRisk(clear,actor(clear),actor(clear,'e')));
  const result=shoot(hidden);assert.deepEqual(flights(result).map(publicFrame),normalFlight);assert.equal(actor(result.ordinary,'e').hp,100,'the filtered display cannot invent downstream injury');
  if(kind==='body')assert.ok(result.ordinary.npcs[0].hp<hidden.npcs[0].hp,'the hidden body still participates in actual physics');
  assert.equal(actor(result.ordinary).loaded,0);assert.equal(actor(result.ordinary).ammo,actor(hidden).ammo);assert.equal(result.ordinary.elapsedSeconds,6);
  for(const frame of result.shown.frames){assert.ok(!frame.impacts.some(impact=>impact.unitId==='private-body'));assert.doesNotMatch(JSON.stringify({visual:frame.shotVisual,impacts:frame.impacts,target:frame.targetPoint}),/private-body|private-stone|trajectoryModel|segments|ricochets|sourceId/);}
  assert.doesNotMatch(result.ordinary.log.join(' '),/Nombre privado|private-stone/);
 }
});

test('valid exterior building and room membership cannot clip a visible paid stone reflection',()=>{
 const clear=field(),normal=shoot(clear),normalFlight=flights(normal).map(publicFrame);
 for(const room of [false,true]){
  const tagged=field(),stone=tagged.tiles.find(tile=>tile.x===8&&tile.y===5);
  tagged.buildings=[{id:'stone-building',x:8,y:5,width:2,height:2,rooms:room?[{id:'stone-room',cells:[{x:8,y:5}]}]:[]}];
  stone.buildingId='stone-building';if(room)stone.roomId='stone-room';
  assert.equal(teamCanSee(tagged,'player',stone),true);
  assert.strictEqual(firearmKnownTerrain(tagged,actor(tagged)).tiles.find(tile=>tile.x===8&&tile.y===5),stone,'the actual exterior face stays known');
  const result=shoot(tagged);assert.deepEqual(flights(result).map(publicFrame),normalFlight);
  assert.deepEqual(result.ordinary.units,normal.ordinary.units);assert.equal(result.ordinary.elapsedSeconds,normal.ordinary.elapsedSeconds);
 }
});

test('only an exact observed exterior stone contact can admit a reflected endpoint or origin',()=>{
 const s=field(),flight=firearmFlightPreview(s,actor(s),point),bounce=flight.ricochets[0];
 const contact={sourceId:bounce.sourceId,point:{...bounce.impact},normal:{...bounce.normal}};
 const first={source:{...flight.segments[0].source},impact:{...bounce.impact},outcome:'cover',material:'stone',impactSurfaceContact:contact};
 const second={source:{...bounce.impact},impact:{...flight.bodyImpacts[0].impact},discharge:false,sourceSurfaceContact:contact};
 const capture=(scene,visual)=>captureBattlePresentation(scene,()=>{const next=structuredClone(scene);recordBattleFrame(next,{type:'projectile',action:'firePoint',unitId:'p',shotVisual:visual});return next;},(state,body)=>teamCanSee(state,'player',body));
 const admitted=capture(s,first),continuation=capture(s,second);
 assert.deepEqual(admitted.frames[0].shotVisual.impact,bounce.impact);assert.equal(admitted.frames[0].shotVisual.material,'stone');
 assert.deepEqual(continuation.frames[0].shotVisual.source,bounce.impact);assert.equal(continuation.frames[0].shotVisual.discharge,false);
 for(const result of [admitted,continuation]){assert.deepEqual(result.state,s);assert.doesNotMatch(JSON.stringify(result.frames.map(frame=>frame.shotVisual)),/SurfaceContact|sourceId|surface:/);}
 for(const change of [
  visual=>{visual.impactSurfaceContact.sourceId='surface:0:9,5';},
  visual=>{visual.impactSurfaceContact.normal={x:1,y:0,height:0};},
  visual=>{visual.impactSurfaceContact.point.x+=.1;},
  visual=>{visual.impact={x:8,y:5,height:1.175,tacticalLevel:0};visual.impactSurfaceContact.point={...visual.impact};},
 ]){
  const forged=structuredClone(first);change(forged);const result=capture(s,forged);
  assert.notDeepEqual(result.frames[0].shotVisual?.impact,forged.impact,'unmatched or interior points cannot use visible-face admission');
 }
 const unmatched=structuredClone(second);unmatched.sourceSurfaceContact.sourceId='surface:0:9,5';
 assert.ok(capture(s,unmatched).frames.every(frame=>!frame.shotVisual),'an unmatched opaque origin cannot disclose a continuation');
 const hidden=field();Object.assign(hidden.tiles.find(tile=>tile.x===4&&tile.y===4),{type:'wall',material:'adobe',blocked:true,blocksSight:true});
 assert.equal(teamCanSee(hidden,'player',hidden.tiles.find(tile=>tile.x===8&&tile.y===5)),false);
 const unproved=structuredClone(first);delete unproved.impactSurfaceContact;
 assert.deepEqual(capture(hidden,first).frames,capture(hidden,unproved).frames,'a real but concealed stone source cannot grant a public contact');
 const concealed=field();Object.assign(actor(concealed,'e'),{x:8,y:5});assert.equal(teamCanSee(concealed,'player',actor(concealed,'e')),false);
 const result=capture(concealed,first);assert.deepEqual(result.frames[0].shotVisual.impact,bounce.impact);
 assert.ok(result.frames.every(frame=>!frame.visibleIds.includes('e')&&!frame.impacts.length));
 assert.doesNotMatch(JSON.stringify(result.frames.map(frame=>frame.shotVisual)),/Enemigo observado|victimId|victimKind/);
 const privateNeighbour=field();privateNeighbour.props=[{id:'private-neighbour',type:'chest',x:8,y:4,material:'stone',obstacleHeight:2,blocksSight:false,roomId:'unrevealed'}];
 assert.equal(teamCanSee(privateNeighbour,'player',privateNeighbour.props[0]),true,'the direct recorder observer has no interior guard');
 assert.deepEqual(capture(privateNeighbour,first).frames.map(frame=>frame.shotVisual),admitted.frames.map(frame=>frame.shotVisual),'interior admission is still required for an adjacent prop');
 const privateTerrain=field();Object.assign(privateTerrain.tiles.find(tile=>tile.x===8&&tile.y===4),{type:'wall',material:'stone',blocked:true,blocksSight:false});
 assert.notDeepEqual(capture(privateTerrain,first).frames[0].shotVisual?.impact,bounce.impact,'an observed adjoining stone column still prevents a false exterior face');
 // A direct recorder can provide a narrower exterior observation set. This
 // case isolates that callback contract; native exterior sight is tested above.
 const exteriorObserver=(state,surface)=>!(surface.x===8&&surface.y===4)&&teamCanSee(state,'player',surface);
 const terrainCapture=captureBattlePresentation(privateTerrain,()=>{const next=structuredClone(privateTerrain);recordBattleFrame(next,{type:'projectile',action:'firePoint',unitId:'p',shotVisual:first});return next;},(state,body)=>teamCanSee(state,'player',body),exteriorObserver);
 assert.deepEqual(terrainCapture.frames.map(frame=>frame.shotVisual),admitted.frames.map(frame=>frame.shotVisual),'an adjacent terrain volume excluded by the exterior observer cannot reveal itself through the contact veto');
});

test('an unobserved stone tile cannot bend or shorten the admitted path, while known stone and supporting geometry stay intact',()=>{
 const clear=createBattle([{id:'p',x:1,y:3,facing:2,weapon:1800,marksmanship:100}],{width:48,height:16,seed:8,tiles:tiles(48,16),weather:{rain:0,humidity:0},enemies:[{id:'e',x:46,y:15,patrol:false,overwatch:false}]}),hidden=structuredClone(clear),stone=hidden.tiles.find(tile=>tile.x===17&&tile.y===7);
 Object.assign(stone,{type:'wall',material:'stone',blocked:true,blocksSight:true});assert.equal(teamCanSee(hidden,'player',stone),false);
 const order={type:'firePoint',unitId:'p',x:28,y:9,aim:4},raw=projectileFlight(hidden,actor(hidden),{x:28,y:9,tacticalLevel:0,stance:'standing'},weaponFor(actor(hidden)));
 assert.equal(raw.ricochets.length,1,'the private tile changes the actual path');
 assert.deepEqual(flights(shoot(hidden,order)).map(publicFrame),flights(shoot(clear,order)).map(publicFrame));
 const known=field(),terrain=firearmKnownTerrain(known,actor(known));assert.strictEqual(terrain.tiles.find(tile=>tile.x===8&&tile.y===5),known.tiles.find(tile=>tile.x===8&&tile.y===5),'an observed exterior stone face remains active');
 const upper={id:'private-upper',x:30,y:14,tacticalLevel:1,elevation:3,kind:'roof',type:'wall',material:'stone',blocked:true};known.upperSurfaces=[upper];
 const filtered=firearmKnownTerrain(known,actor(known)).upperSurfaces[0];assert.equal(filtered.elevation,upper.elevation);assert.equal(filtered.tacticalLevel,upper.tacticalLevel);assert.equal(filtered.obstacleHeight,0);assert.deepEqual(known.upperSurfaces,[upper]);
});

function missedReflection(y=4,blocked=false){
 const s=createBattle([{id:'p',x:12,y,hp:100,energy:100,weapon:1800,agility:75,wisdom:50,practiceSeed:0,skillPractice:{agility:39}}],{width:32,height:16,seed:8,tiles:tiles(32,16),enemies:[{id:'e',x:1,y:3,facing:2,weapon:1805,patrol:false,overwatch:false}]});
 Object.assign(s.tiles.find(tile=>tile.x===8&&tile.y===5),{type:'wall',material:'stone',blocked:true,blocksSight:true});
 if(blocked)Object.assign(s.tiles.find(tile=>tile.x===10&&tile.y===4),{type:'wall',material:'wood',blocked:true,blocksSight:false,projectileResistance:1000});
 const target=actor(s),attacker=actor(s,'e'),weapon=weaponFor(attacker),flight=projectileFlight({...s,units:[attacker]},attacker,point,weapon,'torso',{destinationHeight:1.1});
 return {s,target,flight,event:{attacker,source:attacker,target,weapon,flight,hit:false,discharged:true,damagedBodies:new Set()}};
}
test('hostile near-miss practice uses exact reflected legs once and rejects the original chord, stopped legs and malformed models',()=>{
 const real=missedReflection(),before=structuredClone(real.s);assert.equal(real.flight.segments.length,2);
 assert.equal(practiceFirearmNearMiss(real.s,real.event),1);assert.equal(real.target.agility,76);assert.equal(real.s.seed,before.seed);assert.equal(real.target.hp,100);assert.deepEqual(real.s.log,before.log);
 const learned=structuredClone(real.s);assert.equal(practiceFirearmNearMiss(real.s,real.event),0);assert.deepEqual(real.s,learned);
 for(const r of [missedReflection(5),missedReflection(4,true)]){const before=structuredClone(r.s);assert.equal(practiceFirearmNearMiss(r.s,r.event),0);assert.deepEqual(r.s,before);}
 for(const corrupt of [r=>{delete r.flight.segments;},r=>{r.flight.segments[1].trajectoryModel=null;},r=>{r.flight.segments[1].terminalFraction=NaN;},r=>{r.flight.segments[1].source.height+=.1;},r=>{r.flight.terminal.impact.x+=1;}]){
  const r=missedReflection();corrupt(r);const before=structuredClone(r.s);assert.equal(practiceFirearmNearMiss(r.s,r.event),0);assert.deepEqual(r.s,before);
 }
});

const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
test('mounted reflected playback holds input, presents one discharge and commits the paid final state once',async t=>{
 const s=field(),expected=shoot(s),commits=[],mounted=await mountBattlefield(t,Battlefield,{battle:s,onChange:next=>{commits.push(next);return next;},onFinish(){}},{virtualTimers:true});
 const strip=()=>nodes(mounted.tree()).find(node=>node.props?.onOrder&&node.props?.onEndTurn);
 await mounted.act(async()=>strip().props.onOrder(action));let discharges=0;
 for(const frame of expected.shown.frames){
  assert.equal(strip().props.busy,true);assert.deepEqual(commits,[]);
  if(frame.type==='projectile'&&frame.shotVisual?.discharge!==false)discharges++;
  await mounted.act(async()=>strip().props.onOrder(action));assert.deepEqual(commits,[]);
  assert.equal(await mounted.nextDelay(),battleFrameDuration(frame));
 }
 assert.equal(discharges,1);assert.deepEqual(commits,[expected.ordinary]);assert.equal(strip().props.busy,false);
 assert.equal(actor(expected.ordinary).loaded,0);assert.equal(actor(expected.ordinary).ammo,actor(s).ammo);assert.equal(actor(expected.ordinary).condition,99);
 assert.equal(actor(expected.ordinary).ap,actor(s).ap-actionCosts(s,actor(s),point).fire-4*actionCosts(s,actor(s),point).aim);assert.equal(expected.ordinary.elapsedSeconds,6);
});
