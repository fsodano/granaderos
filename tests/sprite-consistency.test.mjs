import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spriteRender,spriteViewport} from '../game/sprite-render.js';
import {SPRITE_DISPLAY_CALIBRATION} from '../game/sprite-display-calibration.js';
const measurements=JSON.parse(fs.readFileSync(new URL('../assets/previews/sprite-consistency/measurements.json',import.meta.url)));
test('walking cycles match approved idle height without changing scale between frames',()=>{
 for(const [name,scales] of Object.entries(SPRITE_DISPLAY_CALIBRATION))for(let direction=0;direction<8;direction++){
  const family=name.slice(0,-5),dir=['n','ne','e','se','s','sw','w','nw'][direction];
  const reference=measurements.find(r=>r.sheet===family+'-idle'&&r.direction===dir);
  const frames=measurements.filter(r=>r.sheet===name&&r.direction===dir);
  assert.ok(Math.abs(Math.max(...frames.map(r=>r.height))*scales[direction][1]-reference.height)<.02,name);
  const sprite=spriteRender({hp:100,spriteAppearance:family},{moving:true,direction,frame:0});
  const views=[0,1,2,3].map(frame=>spriteViewport(sprite,{x:200,y:200},direction,frame));
  assert.equal(new Set(views.map(v=>`${v.width}/${v.height}/${v.x}/${v.y}`)).size,1,name);
  assert.ok(Math.abs(views[0].x+sprite.anchor[0]*views[0].width/sprite.cell-200)<=.5,name);
  assert.ok(Math.abs(views[0].y+sprite.anchor[1]*views[0].height/sprite.cell-200)<=.5,name);
 }
});
