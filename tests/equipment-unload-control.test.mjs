import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle} from '../game/tactical.js';
const {default:ItemCard}=await import('../web/app/JA2ItemCard.tsx');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
test('clicking the ammunition badge sends the inspected gun slot and unloads once',()=>{
 let battle=createBattle([{id:'p',weapon:1808,loaded:2,ammo:0}],{exploration:true,enemies:[]});
 const card=()=>ItemCard({battle,unit:battle.units[0],reference:'primary',slotId:'hand:right',disabled:false,onOrder:action=>{battle=actBattle(battle,action);}});
 const badge=()=>nodes(card()).find(n=>n.props?.['aria-label']==='Descargar munición');
 assert.equal(badge().props.disabled,false);badge().props.onClick();assert.equal(battle.lastError,null);assert.equal(battle.units[0].loaded,0);assert.equal(battle.units[0].ammo,2);assert.equal(badge().props.disabled,true);
});
