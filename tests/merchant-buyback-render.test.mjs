import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign as dispatch} from '../game/campaign.js';
import {storeEquipment} from '../game/equipment.js';
const {default:UsedEquipment}=await import('../web/app/UsedEquipment.tsx');
const {default:Armory}=await import('../web/app/Armory.tsx');
function field(){const s=initialCampaign();storeEquipment(s,1803,{condition:37,jammed:true});const item=s.armoryItems.pop();s.armory[1803]--;s.merchants.retiro.usedItems.push(item);return s;}
const children=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(children)];
test('the isolated retained armory renders the local used offer, condition, ignition fault and price',()=>{
 const s=field(),before=structuredClone(s),html=render(h(Armory,{state:s,dispatch:()=>{}}));assert.match(html,/Armas usadas del comerciante/);assert.match(html,/Comprar usado · 53 pesos/);assert.match(html,/Estado 37% · Fallo de chispa/);assert.deepEqual(s,before);
});
test('the isolated offer sends its exact saved identity but public purchase rejects without changing custody',()=>{
 const s=field();let sent;const tree=UsedEquipment({state:s,dispatch:a=>sent=a}),button=children(tree).find(n=>n.type==='button');assert.equal(button.props.disabled,false);button.props.onClick();assert.deepEqual(sent,{type:'purchaseUsedEquipment',sector:'retiro',instanceId:s.merchants.retiro.usedItems[0].id});
 const before=structuredClone(s),n=dispatch(s,sent);assert.match(n.lastError,/comercio de equipo no está disponible/);assert.deepEqual({...n,lastError:null},{...before,lastError:null});const html=render(h(UsedEquipment,{state:n,dispatch:()=>{}}));assert.match(html,/Comprar usado · 53 pesos/);
});
test('unavailable offers explain and disable purchase rather than showing another town inventory',()=>{
 const s=field();s.resources.treasury=0;let html=render(h(UsedEquipment,{state:s,dispatch:()=>{}}));assert.match(html,/No hay pesos suficientes/);assert.match(html,/<button[^>]+disabled=""/);
 s.location='cordoba';html=render(h(UsedEquipment,{state:s,dispatch:()=>{}}));assert.match(html,/No hay armas usadas disponibles/);assert.doesNotMatch(html,/Comprar usado ·/);
});
