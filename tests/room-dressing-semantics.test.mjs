import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import {BUILDING_TEMPLATES} from '../game/map-templates.js';
import {blankMap} from '../game/map-schema.js';
import {applyMapCommands} from '../game/map-commands.js';
import {compileMap} from '../game/compile-map.js';
import {buildSectorMap,MAP_IDS} from '../game/maps.js';
import {roomDecorProfile,roomDressings} from '../game/room-dressing.js';
import {propBlocksAt,propCells} from '../game/props.js';
import {spaceKey,tacticalLevel} from '../game/tactical-space.js';
const {createElement}=await import('../web/node_modules/react/index.js');
const {renderToStaticMarkup}=await import('../web/node_modules/react-dom/server.node.js');
const {buildPropObjects}=await import('../web/app/TacticalProps.tsx');
const {presentWorld}=await import('../web/lib/three/presentation.ts');

test('named rooms use their authored function regardless of room order or building family',()=>{
 const names={
  archive:['Archivo municipal','Archive'],
  office:['Secretaría municipal','Despacho privado','Contaduría','Office'],
  reception:['Sala del concejo','Salón de recepción','Sala familiar','Reception'],
  bedroom:['Dormitorio familiar','Cámara del gobernador','Cámara de huéspedes','Bedroom'],
  kitchen:['Cocina','Kitchen'],washroom:['Baño','Lavadero','Washroom'],
  store:['Despensa','Depósito seguro','Sala de mercaderías'],workshop:['Herrería'],
 };
 for(const [purpose,labels]of Object.entries(names))for(const name of labels)for(const kind of ['house','palace','depot'])for(const index of [0,1,2,3]){
  const profile=roomDecorProfile({kind},{name},index);assert.equal(profile.purpose,purpose,`${name} in ${kind} at ${index}`);
  if(['archive','office','reception','bedroom'].includes(purpose))assert.ok(!profile.details.includes('hearth')&&!profile.details.includes('washstand'));
 }
 assert.equal(roomDecorProfile({kind:'palace'},{name:'Cocina',purpose:'office'}).purpose,'office','explicit supported purpose takes priority');
 assert.equal(roomDecorProfile({kind:'palace',ruined:true},{name:'Cámara del gobernador'}).purpose,'ruin','ruin treatment keeps precedence');
 const first=roomDecorProfile({kind:'house'},{name:'Archivo'});first.details.push('hearth');
 assert.ok(!roomDecorProfile({kind:'house'},{name:'Archivo'}).details.includes('hearth'),'callers cannot modify shared profiles');
});

test('unnamed legacy rooms and unrecognized names retain their former floor and item selection',()=>{
 for(const room of [{id:'bedroom'},{name:'Sala sin uso especificado'},{purpose:'unrecognized'}]){
  assert.deepEqual(roomDecorProfile({kind:'house'},room,0),{purpose:'kitchen',floor:'cobble',details:['hearth','shelf','pottery','candle']});
  assert.deepEqual(roomDecorProfile({kind:'house'},room,1),{purpose:'washroom',floor:'cobble',details:['washstand','pottery','shelf']});
  assert.deepEqual(roomDecorProfile({kind:'house'},room,2),{purpose:'quarters',floor:'wood',details:['rug','shelf','candle']});
  assert.equal(roomDecorProfile({kind:'cabildo'},room,0).purpose,'hall');
  assert.equal(roomDecorProfile({kind:'stable'},room,0).purpose,'store');
  assert.equal(roomDecorProfile({kind:'smithy'},room,0).purpose,'workshop');
 }
});

function templateMap(name,rotation=0){
 const result=applyMapCommands(blankMap({id:`dressing-${name}-${rotation}`,width:32,height:32}),[
  {type:'stampTemplate',id:name,template:BUILDING_TEMPLATES[name],x:3,y:3},
  ...Array.from({length:rotation/90},()=>({type:'rotateObject',id:name})),
 ]);
 assert.deepEqual(result.errors,[]);return compileMap(result.document);
}

test('all fourteen compiled templates keep decoration on free floor cells through four rotations',()=>{
 const expected={
  ayuntamiento:{'Secretaría municipal':'office','Archivo municipal':'archive','Sala del concejo':'reception'},
  palacio:{'Cámara del gobernador':'bedroom','Despacho privado':'office','Cámara de huéspedes':'bedroom','Salón de recepción':'reception'},
  deposito:{'Sala de mercaderías':'store','Contaduría':'office','Depósito seguro':'store'},
  estancia:{'Dormitorio familiar':'bedroom','Sala familiar':'reception','Despensa':'store'},
 };
 for(const name of Object.keys(BUILDING_TEMPLATES))for(const rotation of [0,90,180,270]){
  const state=templateMap(name,rotation),before=structuredClone(state),decor=roomDressings(state),tiles=new Map(state.tiles.map(tile=>[spaceKey(tile),tile])),occupied=new Set(state.props.flatMap(propCells).map(spaceKey)),seen=new Set();
  assert.ok(decor.length>0,`${name}:${rotation} has room detail`);
  for(const prop of decor){
   const tile=tiles.get(spaceKey(prop)),room=state.buildings.flatMap(building=>building.rooms).find(room=>room.id===prop.roomId);
   assert.ok(tile&&!tile.blocked&&tile.type==='floor',`${prop.id} has a walkable floor`);
   assert.ok(room.cells.some(cell=>spaceKey(cell)===spaceKey(prop)));assert.deepEqual(prop.footprint,{width:1,height:1});
   assert.equal(prop.blocksMovement,false);assert.equal(prop.decorative,true);assert.ok(!occupied.has(spaceKey(prop))&&!seen.has(spaceKey(prop)));
   assert.ok(!state.tiles.some(door=>door.type==='door'&&Math.abs(door.x-prop.x)+Math.abs(door.y-prop.y)<=1));seen.add(spaceKey(prop));
   if(expected[name])assert.equal(prop.purpose,expected[name][room.name]);
  }
  assert.deepEqual(state,before,'dressing does not modify authored furniture, rooms or collision');
  for(const cell of state.tiles)assert.equal(propBlocksAt(state,cell.x,cell.y),propBlocksAt({...state,props:[...state.props,...decor]},cell.x,cell.y),'decorative props never block movement');
 }
});

test('dressing rejects missing, blocked, structural, occupied and doorway cells at its own physical level',()=>{
 const cells=Array.from({length:30},(_,n)=>({x:1+n%5,y:1+Math.floor(n/5)})),upper=cells.map(cell=>({...cell,tacticalLevel:1,type:'floor',blocked:false,elevation:3}));
 const state={tiles:cells.map(cell=>({...cell,type:'floor',blocked:false})),upperSurfaces:upper,buildings:[{id:'house',kind:'house',rooms:[{id:'upper',name:'Archivo',tacticalLevel:1,cells}]}],props:[{id:'occupied',type:'chest',x:2,y:1,tacticalLevel:1}]};
 upper.find(tile=>tile.x===1&&tile.y===1).blocked=true;upper.find(tile=>tile.x===3&&tile.y===1).type='wall';upper.find(tile=>tile.x===4&&tile.y===1).type='window';upper.find(tile=>tile.x===1&&tile.y===3).type='door';
 state.upperSurfaces=upper.filter(tile=>!(tile.x===5&&tile.y===1));
 const before=structuredClone(state),decor=roomDressings(state);assert.ok(decor.length>0);
 for(const prop of decor){
  assert.equal(tacticalLevel(prop),1);const tile=state.upperSurfaces.find(tile=>spaceKey(tile)===spaceKey(prop));assert.ok(tile&&tile.type==='floor'&&!tile.blocked);
  assert.ok(!propBlocksAt(state,prop.x,prop.y,1));assert.ok(Math.abs(prop.x-1)+Math.abs(prop.y-3)>1);
 }
 assert.deepEqual(state,before);
});

test('named decoration crosses the same existing room-disclosure boundary in both renderers',()=>{
 const map=templateMap('ayuntamiento'),state={...map,lights:[],groundItems:[],units:[]},terrain={...map},rooms=state.buildings.flatMap(building=>building.rooms),archive=rooms.find(room=>room.name==='Archivo municipal');
 assert.ok(archive);
 const hidden=presentWorld(state,terrain,[],new Set(),[],0);assert.equal(hidden.terrain.props.filter(prop=>prop.decorative).length,0);
 const revealed=new Set([archive.id]),shown=presentWorld(state,terrain,[],revealed,[],0),decor=shown.terrain.props.filter(prop=>prop.decorative);
 assert.ok(decor.length>0);assert.ok(decor.every(prop=>prop.roomId===archive.id&&prop.purpose==='archive'));
 const draw=set=>buildPropObjects({state,revealed:set,project:(x,y)=>({x:x*20,y:y*12}),light:()=>1}).map(object=>renderToStaticMarkup(createElement('svg',null,object.node))).join('');
 assert.doesNotMatch(draw(new Set()),/data-decoration=/);assert.match(draw(revealed),/data-room-purpose="archive"/);assert.doesNotMatch(draw(revealed),/data-room-purpose="washroom"/);
});

test('fresh real campaign maps retain valid nonblocking room dressing',()=>{
 for(const sector of MAP_IDS){
  const state=buildSectorMap({sector,squad:[],enemies:[]}),before=structuredClone(state),tiles=new Map([...state.tiles,...(state.upperSurfaces??[])].map(tile=>[spaceKey(tile),tile]));
  for(const prop of roomDressings(state)){const tile=tiles.get(spaceKey(prop));assert.ok(tile&&!tile.blocked&&!['wall','window','door'].includes(tile.type));assert.equal(prop.blocksMovement,false);}
  assert.deepEqual(state,before);
 }
});
