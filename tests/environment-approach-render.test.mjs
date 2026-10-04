import {componentTree} from './component-tree.mjs';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {createBattle,actBattle,environmentTargetAt} from '../game/tactical.js';
import {targetPreview,nearbyEnvironmentModel} from '../game/ja2-hud.js';
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const {default:JA2EnvironmentPanel}=await import('../web/app/JA2EnvironmentPanel.tsx');

test('keyboard tile focus shows the same approach cost before Enter commits the order',()=>{
  const state=createBattle([{id:'p',x:2,y:2,facing:2}],{width:16,height:8,enemies:[{id:'e',x:14,y:6,patrol:false,overwatch:false}]});
  for(const tile of state.tiles)Object.assign(tile,{type:'grass',blocked:false,blocksSight:false});
  Object.assign(state.tiles.find(t=>t.x===4&&t.y===2),{type:'door',doorId:'test',open:false,locked:false,blocked:true,blocksSight:true});
  state.units[1].ap=0;
  const unit=state.units[0];let hover=null,result=null,prevented=false;
  const tree=componentTree(TacticalScene,{state,selected:'p',unit,players:[unit],units:state.units,positions:{},poses:{},directions:{},hover:null,mode:'move',aim:0,reachable:[],showSight:false,sight:new Set(),revealed:new Set(),project:(x,y)=>({x:x*26,y:y*14}),onHover:point=>{hover=point;},onTile:point=>{const ref=environmentTargetAt(state,point);result=actBattle(state,{type:'useItem',unitId:'p',environment:{kind:ref.kind,id:ref.id}});}});
  const nodes=[];function visit(node){if(Array.isArray(node))return node.forEach(visit);if(!node||typeof node!=='object')return;nodes.push(node);visit(node.props?.children);}visit(tree);
  const tile=nodes.find(node=>node.props?.['aria-label']==='C5, obstáculo');assert.ok(tile);assert.equal(tile.props.tabIndex,0);
  tile.props.onFocus();const preview=targetPreview(state,unit,hover);assert.equal(preview.valid,true);assert.equal(preview.pa,12);assert.equal(preview.actionLabel,'Acercarse y abrir');assert.equal(result,null);
  tile.props.onKeyDown({key:'Enter',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(result.lastError,null);assert.equal(result.units[0].ap,unit.ap-preview.pa);assert.equal(result.units[0].x,3);assert.equal(result.tiles.find(t=>t.doorId==='test').open,true);
  tile.props.onBlur();assert.equal(hover,null);
});

test('the mounted wall panel uses the real paid crowbar action and disables absent or broken tools',async t=>{
  const dom=new JSDOM('<!doctype html><div id="root"></div>');
  const globals={window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true};
  const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const host=dom.window.document.getElementById('root'),root=createRoot(host);
  t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
  const tiles=Array.from({length:56},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0}));
  Object.assign(tiles.find(tile=>tile.x===2&&tile.y===3),{type:'wall',material:'adobe',blocked:true,blocksSight:true});
  const state=createBattle([{id:'p',x:1,y:3,facing:2,activeSlot:'tool',activeTool:'inventory:bar',inventory:{bar:{kind:'tool',toolKey:'crowbar',count:1,condition:72,weight:2.5}}}],
    {width:8,height:7,tiles,enemies:[{id:'guard',x:7,y:6,patrol:false,overwatch:false}]});
  let result=null,calls=0;
  const draw=async battle=>{
    const model=nearbyEnvironmentModel(battle,battle.units[0]);
    await act(async()=>root.render(h(JA2EnvironmentPanel,{...model,selected:model.target.key,verb:'',busy:false,contentIndex:0,count:1,
      onTarget(){},onVerb(){},onUse(){calls++;result=actBattle(battle,model.preview.action);},onContent(){},onCount(){},onLoot(){}})));
    host.querySelector('details').open=true;
    return {model,button:host.querySelector('button')};
  };
  const {model,button}=await draw(state);
  assert.equal(button.textContent,`${model.preview.label} · ${model.preview.pa} PA`);assert.equal(button.disabled,false);
  assert.match(host.textContent,new RegExp(`Desgaste de la barreta: hasta ${model.preview.toolWear} puntos`));
  assert.ok(host.querySelector('[aria-label="Puerta, cofre o pared cercana"]'));
  assert.doesNotMatch(host.textContent,/\b(Abierto|Cerrado)\b|% de éxito|contenido permanece|cofre está vacío/i);
  assert.equal(host.querySelector('[aria-label="Objeto del cofre"]'),null);
  await act(async()=>button.click());assert.equal(calls,1);assert.equal(result.lastError,null);
  assert.equal(result.units[0].ap,state.units[0].ap-model.preview.pa);
  assert.equal(result.units[0].inventory.bar.condition,state.units[0].inventory.bar.condition-model.preview.toolWear);
  assert.equal(result.tiles.find(tile=>tile.x===2&&tile.y===3).blocked,false);
  for(const inventory of [{},{bar:{...state.units[0].inventory.bar,condition:0}}]){
    const unavailable=structuredClone(state);unavailable.units[0].inventory=inventory;
    const {model,button}=await draw(unavailable);assert.equal(model.preview.valid,false);assert.equal(button.disabled,true);
    assert.equal(button.title,model.preview.reason);await act(async()=>button.click());assert.equal(calls,1,'disabled control cannot dispatch work');
  }
});
