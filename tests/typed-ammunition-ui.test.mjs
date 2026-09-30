import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {AMMUNITION_TYPES} from '../game/ammunition-types.js';
import {ammoCount} from '../game/ammo-types.js';
import {ammunitionUnitPrice} from '../game/ammunition-market-rules.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {componentTree} from './component-tree.mjs';
const {default:AmmunitionSupplies}=await import('../web/app/AmmunitionSupplies.tsx');
const hosts=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(hosts):[node,...hosts(node.props?.children)];
const ready=()=>{let s=initialCampaign();for(const action of [{type:'recruitCivic',id:110,term:'week'},{type:'wait',hours:6},{type:'ammunition',operativeId:110,family:'ammoMusket',quantity:1,direction:'buy'}]){s=dispatchCampaign(s,action);assert.equal(s.lastError,null);}return s;};
test('ammunition supply form shows compatible guns and submits a finite typed purchase',()=>{
 let state=ready(),action;
 const tree=componentTree(AmmunitionSupplies,{state,dispatch:value=>{action=value;state=dispatchCampaign(state,value);}});
 const nodes=hosts(tree),selector=nodes.find(n=>n.props?.id==='ammunition-type');assert.equal(hosts(selector).filter(n=>n.type==='option').length,4);assert.equal(nodes.find(n=>n.props?.id==='ammunition-quantity').props.max,60,'grouped shop stock keeps the sixty-round purchase limit');
 const markup=render(h(AmmunitionSupplies,{state,dispatch:()=>{}}));assert.match(markup,/Brown Bess/);for(const spec of Object.values(AMMUNITION_TYPES))assert.ok(markup.includes(spec.name));
 const before=structuredClone(state),form=nodes.find(n=>n.type==='form');form.props.onSubmit({preventDefault(){}});
 assert.deepEqual(action,{type:'ammunition',operativeId:110,family:'ammoMusket',quantity:20,direction:'buy'});assert.equal(state.lastError,null);assert.equal(ammoCount(state.operativeState[110],'ammoMusket'),ammoCount(before.operativeState[110],'ammoMusket')+20);assert.equal(state.resources.treasury,before.resources.treasury-20*ammunitionUnitPrice(before,'retiro','ammoMusket'));assert.equal(state.ammunitionShops.retiro.stock.ammoMusket,before.ammunitionShops.retiro.stock.ammoMusket-20);assert.deepEqual(Object.keys(state.resources),['treasury']);assert.equal(ammoCount(decodeSave(encodeSave(state)).campaign.operativeState[110],'ammoMusket'),21);
});
test('unavailable or exhausted ammunition supplies cannot submit a purchase',()=>{
 for(const change of [s=>s.ammunitionShops.retiro.stock.ammoMusket=0,s=>s.resources.treasury=0,s=>s.pendingBattle={},s=>s.recruited=[]]){
  const state=ready();change(state);let calls=0;
  const tree=componentTree(AmmunitionSupplies,{state,dispatch:()=>calls++}),nodes=hosts(tree);
  assert.equal(nodes.find(n=>n.type==='button'&&n.props.type==='submit').props.disabled,true);nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(calls,0);
 }
});
