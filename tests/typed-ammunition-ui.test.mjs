import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {AMMUNITION_TYPES} from '../game/ammunition-types.js';
import {componentTree} from './component-tree.mjs';
const {default:AmmunitionSupplies}=await import('../web/app/AmmunitionSupplies.tsx');
const hosts=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(hosts):[node,...hosts(node.props?.children)];
test('ammunition supply form shows compatible guns and submits a finite typed purchase',()=>{
 let state=initialCampaign(),action;
 const tree=componentTree(AmmunitionSupplies,{state,dispatch:value=>{action=value;state=dispatchCampaign(state,value);}});
 const nodes=hosts(tree),selector=nodes.find(n=>n.props?.id==='ammunition-type');assert.equal(hosts(selector).filter(n=>n.type==='option').length,4);assert.equal(nodes.find(n=>n.props?.id==='ammunition-quantity').props.max,60,'grouped shop stock keeps the sixty-round purchase limit');
 const markup=render(h(AmmunitionSupplies,{state,dispatch:()=>{}}));assert.match(markup,/Brown Bess/);for(const spec of Object.values(AMMUNITION_TYPES))assert.ok(markup.includes(spec.name));
 const before=structuredClone(state),form=nodes.find(n=>n.type==='form');form.props.onSubmit({preventDefault(){}});
 assert.deepEqual(action,{type:'purchaseAmmunition',ammoType:'musket_75',quantity:20});assert.equal(state.lastError,null);assert.equal(state.resources.cartridges,before.resources.cartridges+20);assert.equal(state.resources.treasury,before.resources.treasury-60);assert.equal(state.merchants.retiro.ammunition.musket_75,before.merchants.retiro.ammunition.musket_75-20);
});
test('unavailable or exhausted ammunition supplies cannot submit a purchase',()=>{
 for(const change of [s=>s.merchants.retiro.ammunition.musket_75=0,s=>s.resources.treasury=0,s=>s.pendingBattle={}]){
  const state=initialCampaign();change(state);let calls=0;
  const tree=componentTree(AmmunitionSupplies,{state,dispatch:()=>calls++}),nodes=hosts(tree);
  assert.equal(nodes.find(n=>n.type==='button'&&n.props.type==='submit').props.disabled,true);nodes.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(calls,0);
 }
});
