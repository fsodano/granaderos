import test from 'node:test';
import assert from 'node:assert/strict';
import {itemFlight} from '../game/item-flight.js';
import {surfaceAt,spacePoint} from '../game/tactical-space.js';

const actor=(x,y=3,extra={})=>({x,y,tacticalLevel:0,stance:'standing',...extra});
const roof=(x,y=3,extra={})=>({id:`roof:${x},${y}`,x,y,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0,...extra});
const field=(upperSurfaces=[])=>({width:12,height:8,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),upperSurfaces,props:[]});
const tile=(s,x,y=3)=>s.tiles[y*s.width+x];
const supported=(s,result,destination)=>{assert.equal(result.valid,true,result.reason);assert.equal(result.blocked,false);assert.deepEqual(result.landing,spacePoint(destination));assert.ok(surfaceAt(s,result.landing));assert.ok(result.path.length>=2&&result.path.length<=65);assert.ok(result.path.every(p=>[p.x,p.y,p.height,p.fraction].every(Number.isFinite)));};

test('ordinary tosses follow a bounded parabola and retain their exact ground landing without mutation',()=>{
 const s=field(),source=actor(1),destination=actor(7),before=structuredClone(s),result=itemFlight(s,source,destination);supported(s,result,destination);
 assert.equal(result.path[0].height,1.4);assert.ok(Math.abs(result.path.at(-1).height-.05)<1e-9);assert.equal(result.path[0].tacticalLevel,0);assert.equal(result.path.at(-1).tacticalLevel,0);
 const middle=result.path.find(p=>p.fraction===.5);assert.ok(middle.height>(1.4+.05)/2+.8);assert.deepEqual(s,before);assert.deepEqual(itemFlight(s,source,destination),result);assert.deepEqual(itemFlight(s,{...source,level:99},destination),result,'earned experience level is not physical height');
});

test('walls and closed doors block item transport, while opening the same door clears the flight',()=>{
 const s=field(),source=actor(1),destination=actor(7);Object.assign(tile(s,4),{type:'wall',blocked:true,obstacleHeight:2.5});
 let result=itemFlight(s,source,destination);assert.equal(result.valid,false);assert.equal(result.blocked,true);assert.equal(result.landing,null);assert.ok(result.path.at(-1).fraction<1);
 Object.assign(tile(s,4),{type:'door',open:false});assert.equal(itemFlight(s,source,destination).blocked,true);
 Object.assign(tile(s,4),{open:true,blocked:false});supported(s,itemFlight(s,source,destination),destination);
});

test('the arc can clear low cover but tests the exact sides of thin cover and diagonal corners',()=>{
 const s=field(),source=actor(1),destination=actor(7);Object.assign(tile(s,4),{type:'window',blocked:true,obstacleHeight:.8});supported(s,itemFlight(s,source,destination),destination);
 Object.assign(tile(s,4),{obstacleHeight:1.63});assert.equal(itemFlight(s,source,destination).blocked,true,'cover can meet the descending edge even below the central arc height');
 const diagonal=field();Object.assign(tile(diagonal,2,1),{type:'wall',blocked:true,obstacleHeight:3});assert.equal(itemFlight(diagonal,actor(1,1),actor(4,4)).blocked,true,'corner contacts cannot pass through a closed wall');
});

test('floor slabs stop same-column throws in either direction and a ceiling can block a same-floor toss',()=>{
 const s=field([roof(4)]),below=actor(4),above=actor(4,3,{tacticalLevel:1});
 for(const [source,destination]of [[below,above],[above,below]]){const result=itemFlight(s,source,destination);assert.equal(result.valid,false);assert.equal(result.blocked,true);assert.equal(result.landing,null);}
 const startingCeiling=field([roof(1,3,{elevation:1.5})]);assert.equal(itemFlight(startingCeiling,actor(1),actor(7)).blocked,true,'the launch column ceiling is not skipped');
 const ceiling=field([roof(4,3,{elevation:1.66,slabThickness:.001})]);assert.equal(itemFlight(ceiling,actor(1),actor(7)).blocked,true,'a very thin slab cannot fall between display samples');
});

test('street-to-roof and roof-to-street arcs retain supported elevated landings and reject blocked decor',()=>{
 const s=field([roof(5)]),street=actor(1),high=actor(5,3,{tacticalLevel:1});supported(s,itemFlight(s,street,high),high);supported(s,itemFlight(s,high,street),street);
 const roofFlight=itemFlight(s,street,high);assert.ok(Math.abs(roofFlight.path.at(-1).height-3.05)<1e-9);assert.equal(roofFlight.path.at(-1).tacticalLevel,1);
 s.upperSurfaces[0].blocked=true;assert.equal(itemFlight(s,street,high).valid,false);
});

test('an intervening roof intercepts a descending path instead of delivering it to the street underneath',()=>{
 const s=field([roof(1),roof(4)]),source=actor(1,3,{tacticalLevel:1}),destination=actor(7),result=itemFlight(s,source,destination);
 assert.equal(result.blocked,true);assert.equal(result.valid,false);assert.equal(result.landing,null);
});

test('props use footprints and absolute floor height, and a solid cart is included',()=>{
 const s=field(),source=actor(1),destination=actor(7);s.props=[{id:'barrels',type:'barrels',x:3,y:3,footprint:{width:2,height:1},obstacleHeight:2.3}];assert.equal(itemFlight(s,source,destination).blocked,true);
 s.props[0].obstacleHeight=.4;supported(s,itemFlight(s,source,destination),destination);
 const elevated=field(Array.from({length:7},(_,i)=>roof(i+1))),a=actor(1,3,{tacticalLevel:1}),b=actor(7,3,{tacticalLevel:1});elevated.props=[{id:'below',type:'barrels',x:4,y:3,obstacleHeight:2.3}];supported(elevated,itemFlight(elevated,a,b),b);
 elevated.props=[{...elevated.props[0],id:'above',tacticalLevel:1}];assert.equal(itemFlight(elevated,a,b).blocked,true);
 s.props=[{id:'cart',type:'cart',x:5,y:3,footprint:{width:2,height:1},obstacleHeight:2}];assert.equal(itemFlight(s,source,destination).blocked,true);
 assert.equal(itemFlight(s,source,actor(5)).valid,false,'items cannot land inside a furniture footprint');
});

test('catch endpoints use only the supplied recipient stance and ignore every private body',()=>{
 const source=actor(1),recipient=actor(7,3,{catch:true,stance:'crouched'}),s=field();Object.defineProperty(s,'units',{enumerable:true,get(){throw Error('private roster accessed');}});
 const result=itemFlight(s,source,recipient);supported(s,result,recipient);assert.ok(Math.abs(result.path.at(-1).height-.7)<1e-9);
 assert.deepEqual(itemFlight({...field(),units:[{id:'hidden',...actor(4),hp:100}]},source,recipient),result);
});

test('raised ground blocks flight below its physical height and a harmless same-cell arc stays finite',()=>{
 const s=field(),source=actor(1),destination=actor(7);tile(s,4).elevation=2;assert.equal(itemFlight(s,source,destination).blocked,true);
 supported(s,itemFlight(s,source,source),source);
});

test('invalid coordinates, unsupported floors and corrupt heights fail closed with bounded output',()=>{
 const source=actor(1),s=field();
 for(const destination of [null,actor(NaN),actor(Infinity),actor(1e100),actor(-1),actor(12),actor(3.5),actor(7,3,{tacticalLevel:8}),actor(7,3,{tacticalLevel:null})]){
  const result=itemFlight(s,source,destination);assert.equal(result.valid,false);assert.equal(result.landing,null);assert.ok(result.path.length<=65);
 }
 for(const broken of [null,{...s,width:Infinity},{...s,width:1e9},{...s,props:[{id:'huge',type:'bed',x:3,y:3,footprint:{width:Infinity,height:1}}]}])assert.equal(itemFlight(broken,source,actor(7)).valid,false);
 const elevated=field([roof(7,3,{elevation:NaN})]);assert.equal(itemFlight(elevated,source,actor(7,3,{tacticalLevel:1})).valid,false);
 const large={width:128,height:128,tiles:Array.from({length:128*128},(_,i)=>({x:i%128,y:Math.floor(i/128),type:'grass',blocked:false})),props:[]};supported(large,itemFlight(large,actor(0,0),actor(127,127)),actor(127,127));
});
