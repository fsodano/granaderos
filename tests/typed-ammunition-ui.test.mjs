import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {createBattle} from '../game/tactical.js';
import {ammoCount} from '../game/ammo-types.js';
const {default:AmmunitionSupplies}=await import('../web/app/AmmunitionSupplies.tsx');
const {default:CampaignPockets}=await import('../web/app/CampaignPockets.tsx');

test('ordinary play exposes carried typed cartridges without the former ammunition shop',()=>{
 const state=initialCampaign(),before=structuredClone(state),actions=[];
 assert.equal(render(h(AmmunitionSupplies,{state,dispatch:a=>actions.push(a)})), '');
 const unit=createBattle([{id:'carrier',name:'Portador',weapon:1800,ammunition:{ammoMusket:12,ammoRifle:7,ammoPistol:4,ammoShot:3},ammo:26,medkits:2}],{exploration:true,enemies:[]}).units[0];
 const carried=structuredClone(unit),html=render(h(CampaignPockets,{unit,disabled:false,onOrder:a=>actions.push(a)}));
 assert.match(html,/Bolsillos del combatiente/);assert.match(html,/Manos del combatiente/);assert.doesNotMatch(html,/Comprar|Importar|Precio|ammunition-quantity|ammunition-type/);
 for(const [family,count]of Object.entries({ammoMusket:12,ammoRifle:7,ammoPistol:4,ammoShot:3}))assert.equal(ammoCount(unit,family),count);
 assert.match(html,/12 cartuchos/);assert.match(html,/7 cartuchos/);assert.match(html,/4 cartuchos/);assert.match(html,/3 cartuchos/);
 assert.deepEqual(unit,carried);assert.deepEqual(state,before);assert.deepEqual(actions,[]);
});
