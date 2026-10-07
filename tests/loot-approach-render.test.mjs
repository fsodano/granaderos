import {componentTree} from './component-tree.mjs';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle} from '../game/tactical.js';
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const {default:JA2LootPicker}=await import('../web/app/JA2LootPicker.tsx');
function field(actor={}){
  const s=createBattle([{id:'p',x:2,y:2,facing:2,...actor}],{width:16,height:8,enemies:[{id:'e',x:14,y:6,patrol:false}]});
  for(const tile of s.tiles)Object.assign(tile,{type:tile.x===10?'wall':'grass',blocked:tile.x===10,blocksSight:tile.x===10});
  s.groundItems=[{id:'cartridges',type:'item',item:'ammo',x:6,y:2,count:12,weight:.04},{id:'unseen',type:'item',item:'ammo',x:14,y:2,count:99,weight:.04}];return s;
}
test('the visible ground marker supports focus and keyboard selection without marking unseen piles',()=>{
  const s=field();let hover=null,selected=null,prevented=false;
  const tree=componentTree(TacticalScene,{state:s,selected:'p',unit:s.units[0],players:[s.units[0]],units:s.units,positions:{},poses:{},directions:{},hover:null,mode:'move',aim:0,reachable:[],showSight:false,sight:new Set(),revealed:new Set(),project:(x,y)=>({x:x*26,y:y*14}),onHover:point=>hover=point,onTile:point=>selected=point});
  const nodes=[];function walk(node){if(Array.isArray(node))return node.forEach(walk);if(!node||typeof node!=='object')return;nodes.push(node);walk(node.props?.children);}walk(tree);
  const markers=nodes.filter(node=>node.props?.['data-ground-equipment']);assert.equal(markers.length,1);const marker=markers[0];assert.equal(marker.props['aria-label'],'Equipo en C7 · 1 objeto(s)');
  marker.props.onFocus();assert.deepEqual(hover,{x:6,y:2,loot:true});assert.equal(selected,null);marker.props.onKeyDown({key:'Enter',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.deepEqual(selected,hover);marker.props.onBlur();assert.equal(hover,null);
});
test('the picker labels finite quantities and blocks a full pack without committing an order',()=>{
  const s=field({x:5,ammo:240,priming:0,flints:0,medkits:0,rations:0,torches:0,boleadoras:0});let calls=0;
  const markup=render(h(JA2LootPicker,{battle:s,unit:s.units[0],point:{x:6,y:2},busy:false,onTake:()=>calls++,onClose:()=>{}}));
  assert.match(markup,/<dialog[^>]+aria-labelledby="loot-picker-title"/);assert.match(markup,/aria-label="Objetos disponibles"/);assert.match(markup,/aria-label="Cantidad 1: En el suelo · Cartuchos"[^>]*max="12"/);assert.match(markup,/Recoger selección · 2 PA/);assert.match(markup,/Seleccionar todos/);assert.match(markup,/Limpiar selección/);assert.match(markup,/<button[^>]+class="gold-button"[^>]*disabled/);assert.equal(calls,0);assert.ok(!markup.includes('99'));
});

test('exploration pickup states energy and time without advertising an AP debit',()=>{
 const s=field({x:5});s.mode='exploration';
 const html=render(h(JA2LootPicker,{battle:s,unit:s.units[0],point:{x:6,y:2},busy:false,onTake:()=>{},onClose:()=>{}}));
 assert.match(html,/Recoger consume tiempo/);assert.match(html,/100 EN/);assert.match(html,/Recoger selección/);assert.doesNotMatch(html,/\bPA\b/);
});


test('a resident over loose equipment still talks normally and routes Control-click or Control-Enter to pickup',()=>{
 const s=field({x:5});s.npcs=[{id:'resident',name:'Vecina',x:6,y:2,hp:100,maxHp:100}];const calls=[];
 const tree=componentTree(TacticalScene,{state:s,selected:'p',unit:s.units[0],players:[s.units[0]],units:s.units,positions:{},poses:{},directions:{},hover:null,mode:'move',aim:0,reachable:[],showSight:false,sight:new Set(),revealed:new Set(),project:(x,y)=>({x:x*26,y:y*14}),onHover:()=>{},onTile:point=>calls.push(['pickup',point]),onTalk:npc=>calls.push(['talk',npc.id])});
 const nodes=[];function walk(node){if(Array.isArray(node))return node.forEach(walk);if(!node||typeof node!=='object')return;nodes.push(node);walk(node.props?.children);}walk(tree);
 const group=nodes.find(node=>node.props?.['data-unit-id']==='resident'),hit=group.props.children.find(node=>node?.props?.['data-person-hit-target']);assert.ok(hit);assert.match(hit.props['aria-label'],/^Hablar con/);
 hit.props.onClick({});assert.deepEqual(calls,[['talk','resident']]);hit.props.onClick({ctrlKey:true});assert.equal(calls[1][0],'pickup');assert.equal(calls[1][1].loot,true);assert.equal(calls[1][1].x,6);
 let prevented=false;hit.props.onKeyDown({key:'Enter',ctrlKey:true,preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.deepEqual(calls[2],calls[1]);
});
