import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle} from '../game/tactical.js';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
test('the battlefield explains autonomous militia and retains status without selection controls',()=>{
 const b=createBattle([{id:'p',name:'Contratado',x:1,y:1},{id:'m',name:'Guardia',militia:true,x:2,y:1}],{width:8,height:8,enemies:[],exploration:true});
 const html=render(h(Battlefield,{battle:b,onChange:()=>{},onFinish:()=>{}}));
 assert.match(html,/La milicia combate por su cuenta/);assert.match(html,/Miliciano 1: Guardia/);
 assert.ok(!html.includes('Seleccionar miliciano'));assert.match(html,/Guarnición local/);assert.match(html,/vendar a sus heridos/);
});
