import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
const {default:Panel}=await import('../web/app/StationedArtillery.tsx');
const fixture=()=>{const s=initialCampaign();s.sectorStates.retiro={artillery:[{id:'g',type:'swivel',side:'player',loaded:false,ammo:0,reloadProgress:.4}]};return s;};
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(Array.isArray(n)?n:Array.isArray(n.props?.children)?n.props.children:[n.props?.children]).flatMap(nodes)];
test('the stationed artillery panel shows retained work and emits an exact finite resupply order',()=>{
 const s=fixture();let order;const tree=Panel({state:s,dispatch:a=>order=a}),button=nodes(tree).find(n=>n.type==='button');assert.equal(button.props.disabled,false);button.props.onClick();assert.deepEqual(order,{type:'supplyArtillery',sector:'retiro',gunId:'g',count:1});
 const html=render(h(Panel,{state:s,dispatch:()=>{}}));assert.match(html,/Recarga 40%/);assert.match(html,/0 municiones de reserva/);assert.match(html,/1 pólvora \+ 1 hierro/);
});
test('shortages disable resupply and enemy artillery does not reveal private loads',()=>{
 const s=fixture();s.resources.powder=0;const html=render(h(Panel,{state:s,dispatch:()=>{}}));assert.match(html,/disabled/);assert.match(html,/Faltan pólvora o hierro/);s.sectorStates.retiro.artillery[0].side='enemy';assert.equal(render(h(Panel,{state:s,dispatch:()=>{}})),'');
});
test('transport controls explain preserved loads and display received guns without inventing reserves',()=>{
 const s=fixture();s.artilleryStores={retiro:[{id:'received',type:'bronze4',side:'player',loaded:false,ammo:2,reloadProgress:.25}]};
 const html=render(h(Panel,{state:s,dispatch:()=>{}}));
 assert.match(html,/Destino de la pieza/);assert.match(html,/Enviar pieza/);assert.match(html,/Esperará si se corta la ruta/);assert.match(html,/Piezas transportadas al depósito/);assert.match(html,/Recarga 25%/);assert.match(html,/2 municiones de reserva/);
});
