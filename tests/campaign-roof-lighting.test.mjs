import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSectorMap} from '../game/maps.js';
import {tileIllumination} from '../game/tactical.js';
const {createBuildingRenderer}=await import('../web/app/TacticalBuildings.tsx');
const project=(x,y)=>({x:(x-y)*26,y:(x+y)*14});

test('campaign roof lighting uses the actual upper floor and cannot borrow a lamp from below its slab',()=>{
 const map=buildSectorMap({sector:'tucuman',squad:[],enemies:[],night:true,lights:[]});
 const building=map.buildings.find(b=>b.id==='tucuman:building'),at={x:building.x+2,y:building.y+2};
 const dark={...map,lights:[]},below={...dark,lights:[{...at,radius:4,intensity:1}]},above={...dark,lights:[{...at,tacticalLevel:1,radius:4,intensity:1}]};
 const args=state=>({state,cursorLevel:1,revealed:new Set(),project,light:(x,y,level=0)=>.27+tileIllumination(state,x,y,level)*.73});
 const roofKey=`architecture-roof-${building.rooms[0].id}`;
 const roof=state=>createBuildingRenderer(args(state))().find(o=>o.key===roofKey);
 const brightness=state=>Number(roof(state).node.props.style.filter.match(/brightness\(([^)]+)\)/)[1]);
 assert.ok(tileIllumination(below,at.x,at.y)>tileIllumination(dark,at.x,at.y),'the downstairs lamp is actually lit');
 assert.equal(brightness(below),brightness(dark),'the slab blocks downstairs light from the rendered roof');
 assert.ok(brightness(above)>brightness(dark)+.1,'the lit upper cells brighten the existing roof mesh');
 assert.equal(tileIllumination(above,at.x,at.y),tileIllumination(dark,at.x,at.y),'the roof torch does not light the stacked interior');
 const extinguished={...above,lights:[{...above.lights[0],extinguished:true}]};
 assert.equal(brightness(extinguished),brightness(dark),'a new state clears the old roof brightness');
 const draw=createBuildingRenderer(args(above)),first=draw(),second=draw();
 assert.equal(second.find(o=>o.key===roofKey),first.find(o=>o.key===roofKey),'an unchanged camera reuses the rendered roof');
});
