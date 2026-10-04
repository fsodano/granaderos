import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,canSee,firearmFlightPreview} from '../game/tactical.js';
import {firearmBystanderRisk,firearmBystanderWarning} from '../game/firearm-bystander-risk.js';
import {targetPreview} from '../game/ja2-hud.js';

function field(){
 const state=createBattle([{id:'rescuer',name:'Rescatista',x:1,y:4,weapon:1802,marksmanship:5}],{width:12,height:8,enemies:[{id:'guard',name:'Guardia',x:8,y:4,weapon:1800,patrol:false}],npcs:[{id:'prisoner',name:'Prisionero visible',x:8,y:5,hp:100,maxHp:100,civilianHealthVersion:1,energy:100,unconscious:false,stance:'standing'}]});
 for(const tile of state.tiles){tile.type='grass';tile.blocked=false;tile.blocksSight=false;}
 state.seed=9;return state;
}
test('a visible prisoner outside the aimed line is warned from a legal missed-shot trajectory',()=>{
 const state=field(),before=structuredClone(state),[unit,target]=state.units,prisoner=state.npcs[0];
 assert.ok(canSee(state,unit,prisoner));assert.equal(firearmFlightPreview(state,unit,target).victimId,target.id);
 const risk=firearmBystanderRisk(state,unit,target);
 assert.deepEqual(risk.direct,[]);assert.deepEqual(risk.scatter,[{id:prisoner.id,name:prisoner.name,kind:'npc'}]);
 const preview=targetPreview(state,unit,target,{mode:'fire',aim:0});assert.equal(preview.valid,true);assert.match(preview.coverNote,/Un tiro desviado puede herir a Prisionero visible/);
 assert.deepEqual(state,before,'preview does not consume RNG, ammunition or time');
 let actual;
 for(let seed=1;seed<=300;seed++){
  const result=actBattle({...state,seed},{type:'fire',unitId:unit.id,targetId:target.id,aim:0});
  if(result.npcs[0].hp<prisoner.hp){actual=result;break;}
 }
 assert.ok(actual,'a legal ordinary firearm miss can hit this warned prisoner');assert.equal(actual.lastError,null);assert.equal(actual.units[0].loaded,unit.loaded-1);
});

test('a bystander in the direct line is identified while firing remains a deliberate legal choice',()=>{
 const state=field(),[unit,target]=state.units;Object.assign(state.npcs[0],{x:5,y:4});
 const risk=firearmBystanderRisk(state,unit,target);assert.equal(risk.direct[0].id,'prisoner');
 const preview=targetPreview(state,unit,target,{mode:'fire'});assert.equal(preview.valid,true);assert.match(preview.coverNote,/Personas en la trayectoria: Prisionero visible/);
 assert.equal(firearmBystanderWarning(risk).match(/Prisionero visible/g).length,1);
});

test('unseen, departed and dead civilians cannot leak through the miss preview',()=>{
 for(const hide of [s=>{s.units[0].facing=0;},s=>{s.npcs[0].roomId='unrevealed';},s=>{s.npcs[0].departure={};},s=>{s.npcs[0].hp=0;}]){
  const state=field();hide(state);const [unit,target]=state.units,before=structuredClone(state);
  if(unit.facing===0)assert.equal(canSee(state,unit,state.npcs[0]),false);
  assert.deepEqual(firearmBystanderRisk(state,unit,target),firearmBystanderRisk({...state,npcs:[]},unit,target));
  assert.doesNotMatch(targetPreview(state,unit,target,{mode:'fire'}).coverNote,/Prisionero visible/);assert.deepEqual(state,before);
 }
});

test('a trabuco warns from its actual six-cell cone rather than a rifle miss pattern',()=>{
 const state=field(),[unit,target]=state.units;unit.weapon=1807;
 assert.deepEqual(firearmBystanderRisk(state,unit,target),{direct:[],scatter:[]},'a prisoner beyond the cone is not exposed');
 Object.assign(state.npcs[0],{x:6,y:5});const risk=firearmBystanderRisk(state,unit,target);assert.equal(risk.direct[0].id,'prisoner');assert.deepEqual(risk.scatter,[]);
});

test('known cover blocks miss paths before a visible prisoner and lowered bodies use their actual silhouette',()=>{
 const state=field(),[unit,target]=state.units;
 state.props=[{id:'screen',type:'barrels',x:5,y:0,footprint:{width:1,height:8},blocksMovement:false,blocksSight:false,obstacleHeight:10,projectileResistance:1000}];
 assert.ok(canSee(state,unit,state.npcs[0]));assert.deepEqual(firearmBystanderRisk(state,unit,target),{direct:[],scatter:[]});
 state.props=[];state.npcs[0].stance='prone';assert.deepEqual(firearmBystanderRisk(state,unit,target),{direct:[],scatter:[]});
 state.npcs[0].stance='standing';assert.equal(firearmBystanderRisk(state,unit,target).scatter.length,1);
});

test('visible allies also receive a warning and body collections with matching IDs remain distinct',()=>{
 const state=field(),[unit,target]=state.units;state.units.push({...state.npcs[0],id:state.npcs[0].id,name:'Aliado visible',side:'player',x:8,y:3});
 const risk=firearmBystanderRisk(state,unit,target);assert.deepEqual(new Set(risk.scatter.map(body=>body.kind)),new Set(['npc','unit']));
 assert.match(firearmBystanderWarning(risk),/Aliado visible/);assert.match(firearmBystanderWarning(risk),/Prisionero visible/);
});

test('the second held pistol adds its own penetration risk without changing either weapon',()=>{
 const state=field(),[unit,target]=state.units;unit.weapon=1806;unit.offHand={weapon:1805,count:1,loaded:1,condition:100};
 state.props=[{id:'screen',type:'barrels',x:5,y:0,footprint:{width:1,height:8},blocksMovement:false,blocksSight:false,obstacleHeight:10,projectileResistance:40}];
 assert.deepEqual(firearmBystanderRisk(state,{...unit,offHand:undefined},target),{direct:[],scatter:[]});
 const before=structuredClone(state),risk=firearmBystanderRisk(state,unit,target);assert.equal(risk.scatter[0].id,'prisoner');assert.deepEqual(state,before);
 const preview=targetPreview(state,unit,target,{mode:'fire'});assert.match(preview.coverNote,/Dispar|Un disparo por pistola/);assert.match(preview.coverNote,/Un tiro desviado puede herir/);
});

test('trabuco warning follows the engine path above ground cover and through elevated cover',()=>{
 const state=field(),[unit,target]=state.units;unit.weapon=1807;
 Object.assign(unit,{tacticalLevel:1});Object.assign(target,{tacticalLevel:1});Object.assign(state.npcs[0],{x:6,y:5,tacticalLevel:1});
 state.upperSurfaces=Array.from({length:96},(_,i)=>({id:`roof:${i}`,x:i%12,y:Math.floor(i/12),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}));
 state.props=[{id:'screen',type:'barrels',x:4,y:0,footprint:{width:1,height:8},blocksMovement:false,blocksSight:false,obstacleHeight:2,projectileResistance:1000}];
 assert.equal(firearmBystanderRisk(state,unit,target).direct[0]?.id,'prisoner','ground furniture remains below the shot');
 state.props[0].tacticalLevel=1;
 assert.deepEqual(firearmBystanderRisk(state,unit,target),{direct:[],scatter:[]},'furniture on the firing floor stops the shot');
});

test('cell prefilter retains every exact legal miss victim across long, diagonal and elevated rays',async()=>{
 const {projectileFlight}=await import('../game/projectile-cover.js');
 const {weaponFor}=await import('../game/tactical.js');
 const {absoluteBodyHeight}=await import('../game/sight-geometry.js');
 const state=createBattle([{id:'a',x:10,y:10,weapon:1802}],{width:60,height:60,enemies:[{id:'t',x:42,y:10,weapon:1800,patrol:false}]});
 for(const tile of state.tiles){tile.type='grass';tile.blocked=false;tile.blocksSight=false;}
 const [unit,target]=state.units,friend={...unit,id:'friend',name:'Compañero',x:39,y:13};state.units.push(friend);state.npcs=[];
 for(const elevated of [false,true]){
  state.upperSurfaces=elevated?[{id:'unused-roof',x:59,y:59,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}]:[];
  for(const [tx,ty] of [[42,10],[42,42],[10,42],[0,42],[0,0]]){
   Object.assign(target,{x:tx,y:ty});
   for(const [fx,fy] of [[tx,ty+2],[tx-1,ty-2],[Math.round((10+tx)/2),Math.round((10+ty)/2)],[10,9]]){
    Object.assign(friend,{x:fx,y:fy});
    for(const hitLocation of ['head','legs']){
     const radius=Math.min(4,Math.max(1,Math.ceil(Math.hypot(tx-10,ty-10)/8))),scene={...state,units:state.units.filter(body=>body.id!==target.id)};
     let expected=false;
     for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++){
      if(!dx&&!dy)continue;
      const destination={x:tx+dx,y:ty+dy,stance:target.stance??'standing',mounted:Boolean(target.mounted)};
      const flight=projectileFlight(scene,unit,destination,weaponFor(unit),hitLocation,{destinationHeight:absoluteBodyHeight(state,target,hitLocation)});
      if(flight.bodyImpacts?.some(hit=>hit.victimKind==='unit'&&hit.victimId===friend.id)||!flight.bodyImpacts&&!flight.blocked&&flight.victimId===friend.id)expected=true;
     }
     const risk=firearmBystanderRisk(state,unit,target,hitLocation);
     assert.equal(risk.scatter.some(body=>body.id===friend.id),expected,JSON.stringify({elevated,tx,ty,fx,fy,hitLocation}));
     const direct=projectileFlight(state,unit,target,weaponFor(unit),hitLocation);
     assert.equal(risk.direct.some(body=>body.id===friend.id),direct.bodyImpacts?direct.bodyImpacts.some(hit=>hit.victimKind==='unit'&&hit.victimId===friend.id):!direct.blocked&&direct.victimId===friend.id);
    }
   }
  }
 }
});
