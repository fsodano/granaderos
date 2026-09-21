import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
const {default:Panel}=await import('../web/app/StationedArtillery.tsx');
const {default:Trade}=await import('../web/app/ArtilleryTrade.tsx');
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(Array.isArray(n)?n:Array.isArray(n.props?.children)?n.props.children:[n.props?.children]).flatMap(nodes)];
const fixture=()=>{const s=initialCampaign();s.artilleryStores={retiro:[{id:'gun',type:'bronze4',side:'player',loaded:false,ammo:2,reloadProgress:.25}]};return s;};
test('armory trade controls sell the exact gun and retain its buyback offer when the depot is empty',()=>{
 const s=fixture();let action;const button=nodes(Trade({state:s,dispatch:a=>action=a})).find(n=>n.type==='button');assert.equal(button.props.disabled,false);button.props.onClick();assert.deepEqual(action,{type:'sellArtillery',sector:'retiro',gunId:'gun'});
 const sold=dispatchCampaign(s,action);assert.equal(sold.lastError,null);const html=render(h(Panel,{state:sold,dispatch:()=>{}}));assert.match(html,/Comprar pieza usada/);assert.match(html,/560/);assert.match(html,/Recarga 25%/);assert.match(html,/2 municiones de reserva/);
 const purchase=nodes(Trade({state:sold,dispatch:a=>action=a})).find(n=>n.type==='button');purchase.props.onClick();assert.deepEqual(action,{type:'purchaseUsedArtillery',sector:'retiro',gunId:'gun'});assert.equal(dispatchCampaign(sold,action).lastError,null);
});
test('insufficient merchant funds disable sale and display the reason',()=>{
 const s=fixture();s.merchants.retiro.cash=0;const html=render(h(Trade,{state:s,dispatch:()=>{}}));assert.match(html,/disabled/);assert.match(html,/fondos suficientes/);
});
