import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {SKIN_PALETTES,spriteSkinTone} from '../game/sprite-skin.js';import {verifySpriteSkin} from '../tools/verify-sprite-skin.mjs';
const {default:SpriteFigure}=await import('../web/app/SpriteFigure.tsx');
test('skin tone is stable through faction, posture, death and save reload',()=>{
 for(let id=0;id<40;id++){const u={id:`npc-${id}`,hp:100};const expected=spriteSkinTone(u);assert.equal(spriteSkinTone({...u,hp:0,mounted:true,side:'enemy',stance:'prone'}),expected);assert.equal(spriteSkinTone(JSON.parse(JSON.stringify(u))),expected);}
 assert.equal(new Set(Array.from({length:40},(_,id)=>spriteSkinTone({id:`npc-${id}`}))).size,3);
 for(const tone of Object.keys(SKIN_PALETTES))assert.equal(spriteSkinTone({id:3,skinTone:tone}),tone);
 assert.equal(spriteSkinTone({skinTone:'white'}),'light');assert.equal(spriteSkinTone({skinTone:'black'}),'dark');
 assert.equal(spriteSkinTone({id:3}),'dark');assert.equal(spriteSkinTone({id:7}),'dark');
});
test('all active sheets have source-matched masks and immutable base art',async()=>{await verifySpriteSkin(new URL('../web/public',import.meta.url).pathname);});
test('skin filters affect only the overlay and have separate instance IDs',()=>{
 const markup=render(h('svg',null,...['light','brown','dark'].map(skinTone=>h(SpriteFigure,{key:skinTone,unit:{id:3,hp:100,skinTone},position:{x:0,y:0},motion:{direction:4,frame:0,moving:false}}))));
 for(const tone of ['light','brown','dark'])assert.ok(markup.includes(`data-skin-tone="${tone}"`));
 assert.equal((markup.match(/data-skin-layer="true"/g)||[]).length,3);
 assert.equal(new Set([...markup.matchAll(/<filter id="([^"]+)"/g)].map(m=>m[1])).size,3);
 for(const image of markup.matchAll(/<image[^>]+href="\/art\/illustrated\/[^>]+>/g))assert.ok(!image[0].includes('filter='));
});
test('death uses the exact final collapse mask without a skin colour jump',async()=>{
 const dir=new URL('../web/public/art/skin/',import.meta.url).pathname,m=JSON.parse(await readFile(`${dir}manifest.json`));
 for(const name of Object.keys(m.masks).filter(n=>n.endsWith('-collapse'))){const cell=m.masks[name].size[0]/4;
  for(let d=0;d<8;d++){
   const final=await sharp(`${dir}${name}.png`).extract({left:3*cell,top:d*cell,width:cell,height:cell}).raw().toBuffer();
   const dead=await sharp(`${dir}${name.replace('-collapse','-dead-idle')}.png`).extract({left:d*cell,top:0,width:cell,height:cell}).raw().toBuffer();assert.deepEqual(dead,final);
  }
 }
});

// Exercise actual selection and SVG output, rather than just the asset list.
test('every active animation renders all three skin tones in all eight directions',async()=>{
 const {SPRITE_APPEARANCES}=await import('../game/sprite-appearances.js');
 const {SPRITE_SKIN_MASKS}=await import('../game/sprite-skin-masks.js');
 const cases=[
  [{},false,'idle'],[{},true,'idle'],[{movementMode:'run'},true,'idle'],
  [{stance:'crouched'},false,'idle'],[{stance:'crouched'},true,'idle'],
  [{stance:'prone'},false,'idle'],[{stance:'prone'},true,'idle'],
  [{mounted:true},false,'idle'],[{mounted:true},true,'idle'],[{mounted:true,movementMode:'run'},true,'idle'],
  ...['aim','fire','reload'].flatMap(pose=>[ [{},false,pose],[{stance:'crouched'},false,pose],[{stance:'prone'},false,pose] ]),
  [{},false,'strike'],[{mounted:true},false,'strike'],[{},false,'interact'],[{stance:'crouched'},false,'interact'],
  [{hp:0},false,'collapse'],[{unconscious:true},false,'idle'],[{mounted:true},false,'fire'],[{mounted:true},false,'reload'],
  [{stance:'prone',weaponDropped:true},false,'idle'],[{stance:'prone',weaponDropped:true},true,'idle'],[{hp:0},false,'idle'],
 ];
 const seen=new Set();
 for(const spriteAppearance of Object.keys(SPRITE_APPEARANCES))for(const [change,moving,pose] of cases)for(const skinTone of Object.keys(SKIN_PALETTES))for(let direction=0;direction<8;direction++){
  const unit={id:'audit',spriteAppearance,skinTone,hp:100,weapon:1800,activeSlot:'primary',...change};
  const markup=render(h(SpriteFigure,{unit,pose,position:{x:100,y:100},motion:{direction,moving,frame:6,elapsedMs:600}}));
  const name=markup.match(/data-sprite="([^"]+)"/)[1];seen.add(name);
  assert.ok(!markup.includes('data-sprite-fallback='),name);
  assert.ok(markup.includes(`data-skin-tone="${skinTone}"`),name);
  assert.ok(markup.includes(`href="/art/skin/${name}.png"`),name);
  assert.equal((markup.match(/data-skin-layer="true"/g)||[]).length,1,name);
  const [x,y,w,hgt]=markup.match(/viewBox="([^"]+)"/)[1].split(' ');
  assert.ok(markup.includes(`filterUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${hgt}"`),`${name} filter must follow the current frame`);
 }
 assert.deepEqual([...seen].sort(),[...SPRITE_SKIN_MASKS].sort());
});
test('authored skin descriptions do not get confused with hair or eye colour',()=>{
 assert.equal(spriteSkinTone({id:110}),'dark','Acosta portrait');
 assert.equal(spriteSkinTone({id:119}),'dark','authored portrait');
 assert.equal(spriteSkinTone({id:122}),'brown','light brown skin, dark brown eyes');
 assert.equal(spriteSkinTone({id:127}),'dark','medium dark skin');
 assert.equal(spriteSkinTone({id:136}),'dark','dark skin');
});
test('battle creation and scene rendering retain tones for allies, enemies and civilians',async()=>{
 const {createBattle}=await import('../game/tactical.js');
 const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
 const s=createBattle([{id:'ally',x:1,y:1,skinTone:'dark'}],{width:8,height:8,exploration:true,enemies:[{id:'hostile',x:2,y:1,skinTone:'brown'}]});
 s.npcs=[{id:'civilian',name:'Civilian',x:1,y:2,hp:100,skinTone:'light',spriteAppearance:'woman-shawl'}];
 const markup=render(h('svg',null,h(TacticalScene,{state:JSON.parse(JSON.stringify(s)),players:s.units.filter(u=>u.side==='player'),units:s.units,positions:{},poses:{},directions:{},reachable:[],sight:new Set(),revealed:new Set(),project:(x,y)=>({x:x*26,y:y*14})})));
 for(const [id,tone,name] of [['ally','dark','granadero-idle'],['hostile','brown','royalist-idle'],['civilian','light','woman-shawl-idle']]){
  const person=markup.split(`data-unit-id="${id}"`)[1]?.split('data-unit-id=')[0];
  assert.ok(person,`${id} reaches the scene`);
  assert.ok(person.includes(`data-skin-tone="${tone}"`),id);
  assert.ok(person.includes(`href="/art/skin/${name}.png"`),id);
 }
});
test('friar scalp highlights are included in the skin layer in every direction',async()=>{
 const {data,info}=await sharp(new URL('../web/public/art/skin/friar-idle.png',import.meta.url).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 // Reviewed exposed-head pixels omitted by the original parser.
 for(const [x,y] of [[70,40],[229,31],[383,31],[541,30],[697,34],[857,32],[1014,32],[1175,32]])assert.ok(data[(y*info.width+x)*4+3]>0,`scalp pixel ${x},${y}`);
});
