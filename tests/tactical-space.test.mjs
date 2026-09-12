import test from 'node:test';
import assert from 'node:assert/strict';
import {accessStepsFrom,canWalkBetween,sameCell,sameSurface,spaceKey,surfaceAt,surfaceHeight,surfacesAtLevel,tacticalLevel,validateTacticalSpace} from '../game/tactical-space.js';
import {buildTerrace,placeBuilding} from '../game/buildings.js';
import {propBlocksAt,propCells,propPlacementError} from '../game/props.js';
import {buildSectorMap,MAP_IDS} from '../game/maps.js';
import {expandSectorMap} from '../game/sector-expansion.js';
import {createBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const ground=(width=12,height=10)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
function terraceFixture(){
 const built=placeBuilding(ground(),{id:'terrace',x:4,y:3,width:4,height:4,roof:'terrace',doors:[{x:5,y:6,open:true}]});
 const geometry=buildTerrace(built.building,{climbPoints:[{id:'west',from:{x:3,y:4},to:{x:4,y:4}}]});
 // Inert foundation: the reducer owner adds the opt-in createBattle geometry copy.
 return Object.assign(createBattle([{id:'p',x:3,y:4,level:7}],{width:12,height:10,tiles:built.tiles,buildings:[built.building],exploration:true,enemies:[]}),geometry);
}
test('physical levels ignore recruit grade and do not normalize legacy ground saves',()=>{
 const state=createBattle([{id:'p',x:1,y:1,level:7}],{width:12,height:10,tiles:ground(),exploration:true,enemies:[]}),before=JSON.stringify(state);
 assert.equal(tacticalLevel(state.units[0]),0);assert.equal(surfaceHeight(state,state.units[0]),0);
 assert.deepEqual(validateBattleSnapshot(state),state);assert.equal(JSON.stringify(state),before);
 assert.equal(Object.hasOwn(state,'upperSurfaces'),false);assert.equal(Object.hasOwn(state.units[0],'tacticalLevel'),false);
 assert.equal(sameSurface({x:1,y:1},{x:8,y:8,tacticalLevel:0}),true);
 assert.equal(sameCell({x:1,y:1},{x:1,y:1,tacticalLevel:1}),false);
 assert.notEqual(spaceKey({x:1,y:1}),spaceKey({x:1,y:1,tacticalLevel:1}));
});
test('sparse lookup keeps stacked cells separate and requires supported integer positions',()=>{
 const s=terraceFixture(),roof={x:5,y:4,tacticalLevel:1};
 assert.equal(surfaceAt(s,roof).id,'terrace:roof:1:1');assert.equal(surfaceHeight(s,roof),3);assert.equal(surfaceHeight(s,{...roof,tacticalLevel:0}),0);
 assert.equal(surfacesAtLevel(s,1).length,16);
 for(const p of [{x:5.2,y:4,tacticalLevel:1},{x:3,y:4,tacticalLevel:1},{x:5,y:4,tacticalLevel:null},{x:-1,y:0}]){assert.equal(surfaceAt(s,p),null);assert.equal(surfaceHeight(s,p),null);}
 const next={...s,upperSurfaces:s.upperSurfaces.filter(p=>!sameCell(p,roof))};assert.equal(surfaceAt(next,roof),null);assert.equal(surfaceAt(s,roof).elevation,3);
});
test('walking requires continuous equal-height surfaces and diagonal support; links describe paid transitions',()=>{
 const s=terraceFixture(),from={x:4,y:4,tacticalLevel:1},to={x:5,y:5,tacticalLevel:1};
 assert.equal(canWalkBetween(s,from,to),true);assert.equal(canWalkBetween(s,from,{x:3,y:4}),false);
 const raised={...s,upperSurfaces:s.upperSurfaces.map(p=>sameCell(p,to)?{...p,elevation:3.5}:p)};assert.equal(canWalkBetween(raised,from,to),false);
 const hole={...s,upperSurfaces:s.upperSurfaces.filter(p=>!sameCell(p,{x:4,y:5,tacticalLevel:1}))};assert.equal(canWalkBetween(hole,from,to),false);
 const up=accessStepsFrom(s,{x:3,y:4});assert.deepEqual(up,[{x:4,y:4,tacticalLevel:1,kind:'climb',linkId:'terrace:climb:west',from:{x:3,y:4,tacticalLevel:0}}]);
 assert.deepEqual(accessStepsFrom(s,up[0]),[{x:3,y:4,tacticalLevel:0,kind:'climb',linkId:'terrace:climb:west',from:{x:4,y:4,tacticalLevel:1}}]);
 assert.deepEqual(accessStepsFrom(s,{x:3,y:5}),[]);assert.equal(Object.hasOwn(up[0],'cost'),false);
});
test('a flat authored terrace supports ground and upper people, items and props in the same columns',()=>{
 const s=terraceFixture();Object.assign(s.units[0],{x:4,y:4,tacticalLevel:1});
 s.groundItems=[{id:'low',type:'ammo',x:5,y:4,count:1},{id:'high',type:'ammo',x:5,y:4,tacticalLevel:1,count:2}];
 s.props=[{id:'high-bed',type:'bed',x:5,y:4,tacticalLevel:1,footprint:{width:2,height:1},blocksMovement:true}];
 assert.deepEqual(validateBattleSnapshot(s),s);
 assert.deepEqual(propCells(s.props[0]),[{x:5,y:4,tacticalLevel:1},{x:6,y:4,tacticalLevel:1}]);
 assert.equal(propBlocksAt(s,5,4),false);assert.equal(propBlocksAt(s,5,4,1),true);
 const groundProp={id:'low-chest',type:'chest',x:5,y:4};assert.equal(propPlacementError(s,groundProp),null);
 assert.equal(propPlacementError({...s,props:[groundProp]},s.props[0]),null);
 assert.match(propPlacementError(s,{...s.props[0],id:'overlap'}),/overlaps/);
 assert.deepEqual(propCells(groundProp),[{x:5,y:4}]);
});
test('save validation rejects unsupported levels, malformed geometry, and invalid access endpoints',()=>{
 const mutations=[
  s=>s.upperSurfaces=null,s=>s.climbLinks=null,s=>s.tiles[0].tacticalLevel=1,s=>s.tiles[0].elevation=NaN,
  s=>s.upperSurfaces[0].id='__proto__',s=>s.upperSurfaces[0].id='constructor',s=>s.upperSurfaces.push({...s.upperSurfaces[0],id:'duplicate-cell'}),
  s=>s.upperSurfaces[0].elevation=Infinity,s=>s.upperSurfaces[0].elevation=.1,s=>s.upperSurfaces[0].slabThickness=-1,
  s=>s.upperSurfaces[0].tacticalLevel=null,s=>s.upperSurfaces[0].tacticalLevel=1.5,s=>s.upperSurfaces[0].x=-1,
  s=>s.upperSurfaces[0].buildingId='missing',s=>s.upperSurfaces[0].roomId=s.buildings[0].rooms[0].id,
  s=>s.climbLinks[0].id=s.upperSurfaces[0].id,s=>s.climbLinks[0].from={x:0,y:0},s=>s.climbLinks[0].to.tacticalLevel=2,
  s=>s.climbLinks.push({...s.climbLinks[0],id:'duplicate-edge'}),s=>s.upperSurfaces.find(p=>sameCell(p,s.climbLinks[0].to)).blocked=true,
  s=>s.units[0].tacticalLevel=1,s=>s.units[0].tacticalLevel=null,
  s=>s.groundItems.push({id:'floating',type:'ammo',count:1,x:0,y:0,tacticalLevel:1}),
  s=>s.props.push({id:'unsupported',type:'bed',x:7,y:4,tacticalLevel:1,footprint:{width:2,height:1}}),
 ];
 for(const [index,mutate]of mutations.entries()){const s=terraceFixture();mutate(s);assert.throws(()=>validateBattleSnapshot(s),undefined,`mutation ${index}`);}
});
test('terrace IDs and access endpoints survive compact-map expansion without enabling existing maps',()=>{
 const core=buildSectorMap({sector:'retiro',compactLayout:true,exploration:true,enemies:[]}),building=core.buildings[0];
 const geometry=buildTerrace({...building,roof:'terrace'},{climbPoints:[{id:'west',from:{x:building.x-1,y:building.y+1},to:{x:building.x,y:building.y+1}}]});
 Object.assign(core,geometry);const expanded=expandSectorMap(core);
 for(const surface of geometry.upperSurfaces){const moved=expanded.upperSurfaces.find(p=>p.id===surface.id);assert.deepEqual(moved,{...surface,x:surface.x+22,y:surface.y+16});}
 assert.deepEqual(expanded.climbLinks,geometry.climbLinks.map(l=>({...l,from:{...l.from,x:l.from.x+22,y:l.from.y+16},to:{...l.to,x:l.to.x+22,y:l.to.y+16}})));
 validateTacticalSpace(expanded);
 for(const sector of MAP_IDS){const map=buildSectorMap({sector});assert.equal(Object.hasOwn(map,'upperSurfaces'),false,sector);assert.equal(Object.hasOwn(map,'climbLinks'),false,sector);}
 assert.throws(()=>buildTerrace({...building,roof:'tile'}));
});
