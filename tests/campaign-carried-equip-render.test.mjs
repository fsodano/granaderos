import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {rosterFor,dispatchCampaign} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
const {default:SectorInventory,EquipCarriedItem,PrepareCarriedHands}=await import('../web/app/SectorInventory.tsx');
const fixture=()=>{const s=initialCampaign();s.operativeState[3].inventory={recovered:{weapon:1800,count:1,weight:4,loaded:0,reloadProgress:.5,condition:62}};return s;};
const buttons=node=>Array.isArray(node)?node.flatMap(buttons):!node||typeof node!=='object'?[]:[...(node.type==='button'?[node]:[]),...buttons(node.props?.children)];
test('an unscouted friendly town allows carried equipment while ground transfers remain disabled',()=>{
 const s=fixture(),html=render(h(SectorInventory,{state:s,sectorId:'retiro',dispatch:()=>{}}));
 assert.match(html,/Primero reconocé y asegurá el sector/);assert.match(html,/Recarga 50%/);assert.match(html,/Estado 62%/);assert.match(html,/<button[^>]*aria-label="Bolsillo grande 1: Brown Bess · 1"/);assert.doesNotMatch(html,/<button[^>]*disabled=""[^>]*aria-label="Bolsillo grande 1:/);
});
test('the item control sends its selected hand and applies the actual recovered weapon',()=>{
 let s=fixture();const row=sectorInventoryModel(s,'retiro',rosterFor(s),3).carried.find(row=>row.inventoryKey==='recovered');const [button]=buttons(EquipCarriedItem({row,onEquip:slot=>{s=dispatchCampaign(s,{type:'sectorInventory',sector:'retiro',operativeId:3,direction:'equip',inventoryKey:row.inventoryKey,expected:row.expected,slot});}}));button.props.onClick();assert.equal(s.lastError,null);assert.equal(s.loadouts[3].weapon,1800);assert.equal(s.operativeState[3].carriedReloadProgress,.5);
 s.operativeState[3].asleep=true;s.operativeState[3].inventory.another={weapon:1800,count:1,weight:4,loaded:1};const blocked=sectorInventoryModel(s,'retiro',rosterFor(s),3).carried.find(row=>row.inventoryKey==='another');assert.ok(buttons(EquipCarriedItem({row:blocked,onEquip:()=>{}})).every(button=>button.props.disabled));
});


test('hand controls identify the item and prepare bandages through the campaign reducer',()=>{
 let s=fixture();s.operativeState[3].medkits=1;const row=sectorInventoryModel(s,'retiro',rosterFor(s),3).carried.find(row=>row.item==='medkits');
 const html=render(h(PrepareCarriedHands,{row,onPrepare(){}}));assert.match(html,/aria-label="Poner en mano principal: Vendas"/);assert.match(html,/aria-label="Poner en segunda mano: Vendas"/);
 const main=buttons(PrepareCarriedHands({row,onPrepare:action=>{s=dispatchCampaign(s,{type:'sectorInventory',sector:'retiro',operativeId:3,direction:'equip',...action});}}))[0];assert.equal(main.props.disabled,false);main.props.onClick();assert.equal(s.lastError,null);assert.equal(s.operativeState[3].activeSlot,'medical');assert.equal(s.operativeState[3].medkits,1);
 const selected=sectorInventoryModel(s,'retiro',rosterFor(s),3).carried.find(row=>row.item==='medkits');assert.match(render(h(PrepareCarriedHands,{row:selected,onPrepare(){}})),/<button[^>]*disabled=""[^>]*aria-label="En mano principal: Vendas"/);
 s.operativeState[3].asleep=true;const asleep=sectorInventoryModel(s,'retiro',rosterFor(s),3).carried.find(row=>row.item==='medkits');assert.ok(buttons(PrepareCarriedHands({row:asleep,onPrepare(){}})).every(button=>button.props.disabled));
});
