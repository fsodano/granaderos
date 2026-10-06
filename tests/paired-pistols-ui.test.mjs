import {formatAP} from '../game/action-points.js';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,actionCosts} from '../game/tactical.js';
import {targetPreview} from '../game/ja2-hud.js';
const {default:AimCursor}=await import('../web/app/AimCursor.tsx');
const field=()=>createBattle([{id:'p',x:1,y:1,facing:2,weapon:1806,loaded:1,marksmanship:85,offHand:{weapon:1808,count:1,weight:1.3,condition:100,loaded:2,instanceId:'second'}}],{width:8,height:8,seed:45,tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:5,y:1,overwatch:false,patrol:false}]});
const draw=(s,aim=2)=>{const preview=targetPreview(s,s.units[0],s.units[1],{mode:'fire',aim,hitLocation:'head'});return render(h('svg',null,h(AimCursor,{point:{x:80,y:90},aim,preview,target:s.units[1]})));};

test('the existing aiming cursor renders one paired AP total while retaining the clicked body region',()=>{
 const s=field(),cost=actionCosts(s,s.units[0],s.units[1]),html=draw(s);assert.match(html,/Cabeza/);assert.ok(html.includes(`${formatAP(cost.fire+2*cost.aim)} PA`));assert.ok(html.includes(`${formatAP(s.units[0].ap-cost.fire-2*cost.aim)} PA restantes`));assert.equal((html.match(/class="aim-step filled"/g)||[]).length,2);assert.equal((html.match(/class="aim-step"/g)||[]).length,2);assert.match(html,/pointer-events="none"/);
});

test('a loaded second pistol cannot hide the main-hand reload arrow or no-ammunition cross',()=>{
 const s=field();s.units[0].loaded=0;setTestAmmunition(s.units[0],1);let html=draw(s);assert.match(html,/aim-reload/);assert.match(html,/Recargar · \d+(?:,\d+)? PA/);assert.doesNotMatch(html,/aim-step|Cabeza/);
 setTestAmmunition(s.units[0],0);html=draw(s);assert.match(html,/class="aim-empty"/);assert.match(html,/Sin munición/);assert.doesNotMatch(html,/aim-reload|aim-step/);assert.equal(s.units[0].offHand.loaded,2);
});
