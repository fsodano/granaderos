import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Bound the process: the old fractional grid trace exhausts memory synchronously,
// so an in-process test timeout cannot stop it.
test('night rendering stays bounded while walking through torch light',()=>{
 const script=`
 import {register} from 'node:module';
 register('./tests/tactical-render-loader.mjs',import.meta.url);
 const {createElement:h}=await import('./web/node_modules/react/index.js');
 const {renderToStaticMarkup:render}=await import('./web/node_modules/react-dom/server.node.js');
 const {default:Scene}=await import('./web/app/TacticalScene.tsx');
 const {default:Battlefield}=await import('./web/app/Battlefield.tsx');
 const {createBattle,tileIllumination,hasLineOfSight}=await import('./game/tactical.js');
 const {default:assert}=await import('node:assert/strict');
 const s=createBattle([{id:'walker',x:2,y:2}],{width:8,height:8,night:true,exploration:true,enemies:[],lights:[{x:4,y:4,radius:4}]});
 s.tiles.forEach(t=>{t.blocked=false;t.blocksSight=false;t.type='grass';});
 for(let frame=0;frame<40;frame++){
  const x=2+frame/20,y=3+frame/40;
  const light=tileIllumination(s,x,y);
  assert.ok(Number.isFinite(light)&&light>=.08&&light<=1);
  const html=render(h('svg',null,h(Scene,{state:s,players:s.units,units:s.units,positions:{walker:{x,y,moving:true,frame:frame%8,direction:3}},poses:{},directions:{},reachable:[],sight:new Set(),revealed:new Set(),project:(x,y)=>({x:x*26,y:y*14})})));
  assert.match(html,/data-moving="true"/);
 }
 const wall=s.tiles.find(t=>t.x===3&&t.y===4);wall.blocksSight=true;
 assert.equal(hasLineOfSight(s,{x:4,y:4},{x:2.2,y:4.1}),false);
 assert.equal(tileIllumination(s,2.2,4.1),.08);
 wall.blocksSight=false;
 assert.ok(tileIllumination(s,2.2,4.1)>.08);
 for(const x of [0,1.2,2.5,4,6.8])for(const y of [0,1.3,3.5,4,6.9])assert.equal(hasLineOfSight(s,{x:4.2,y:4.3},{x,y}),true);
 const html=render(h(Battlefield,{battle:s,onChange:()=>{},onFinish:()=>{}}));
 assert.doesNotMatch(html,/Pausar exploración|Reanudar exploración|Tiempo de exploración/);
 console.log('40 night movement frames and blocked light verified');
 `;
 const result=spawnSync(process.execPath,['--max-old-space-size=128','--input-type=module','-e',script],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,`${result.error??''}\n${result.stderr}`);
 assert.match(result.stdout,/40 night movement frames/);
});
