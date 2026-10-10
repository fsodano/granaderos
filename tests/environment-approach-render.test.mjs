import {formatAP} from '../game/action-points.js';
import {componentTree} from './component-tree.mjs';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {createBattle,actBattle,presentedActBattle,containerLootPreview,environmentTargetAt} from '../game/tactical.js';
import {makeOutfit} from '../game/outfits.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {targetPreview,nearbyEnvironmentModel} from '../game/ja2-hud.js';
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const {default:JA2EnvironmentPanel}=await import('../web/app/JA2EnvironmentPanel.tsx');
const {default:JA2Inventory}=await import('../web/app/JA2Inventory.tsx');

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

test('the real inventory keeps a disclosed chest selection pinned until the player reselects the shifted item',async t=>{
  const dom=new JSDOM('<!doctype html><div id="root"></div>'),globals={window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true};
  const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const host=dom.window.document.getElementById('root'),root=createRoot(host),noop=()=>{},orders=[];
  t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
  const crowbar={item:'inventory:used-crowbar',itemType:'tool',toolKey:'crowbar',count:1,weight:2.5,condition:60,instanceId:'declared:used-crowbar'},shirt={item:'inventory:linen',...makeOutfit('linen_shirt',75),instanceId:'declared:linen'};
  let battle=createBattle([{id:'p',x:1,y:3,facing:2,weapon:1805,inventory:{}}],{width:14,height:8,seed:45,tiles:Array.from({length:112},(_,i)=>({x:i%14,y:Math.floor(i/14),type:'grass',blocked:false,blocksSight:false,cover:0})),props:[{id:'declared-chest',type:'chest',x:2,y:3,open:false,locked:false,contents:[crowbar,shirt]}],enemies:[{id:'e',x:12,y:6,patrol:false,overwatch:false}]});
  const initial=structuredClone(battle),ref={kind:'container',id:'declared-chest'};
  const draw=async()=>{const unit=battle.units[0];await act(async()=>root.render(h(JA2Inventory,{battle,unit,units:battle.units,selected:unit.id,mode:'move',showSight:false,busy:false,missionAllies:[],localMilitia:[],vw:600,vh:400,cameraRect:{x:0,y:0,width:200,height:150},project:(x,y)=>({x:x*26,y:y*14}),zoom:1,onOrder:action=>{orders.push(action);const before=battle;const ordinary=actBattle(before,{...action,unitId:unit.id});assert.equal(ordinary.lastError,null);assert.deepEqual(presentedActBattle(before,{...action,unitId:unit.id}).state,ordinary);battle=ordinary;},onMode:noop,onToggleSight:noop,onSelect:noop,onRetreat:noop,onCameraCenter:noop,onCameraPan:noop,onZoom:noop,onCloseInventory:noop})));};
  const panel=()=>host.querySelector('.ja2-environment-panel'),pickup=()=>[...panel().querySelectorAll('button')].find(button=>button.textContent.startsWith('Recoger'));
  const outdoor=battle;const hidden=structuredClone(battle);Object.assign(hidden.props[0],{roomId:'private',open:true});
  battle=validateBattleSnapshot(hidden);await draw();
  assert.match(panel().textContent,/cercanos · 0/);assert.doesNotMatch(panel().textContent,/Barreta|Camisa de lino|Estado (60|75)%|Abierto|Cerrado/);
  assert.equal(pickup(),undefined);assert.equal(panel().querySelector('[aria-label="Objeto del cofre"]'),null);assert.equal(orders.length,0);
  battle=outdoor;
  await draw();assert.match(panel().textContent,/contenido permanece oculto/);assert.doesNotMatch(panel().textContent,/Barreta|Camisa de lino|Estado (60|75)%/);assert.equal(pickup(),undefined);
  await act(async()=>panel().querySelector('button').click());await draw();assert.equal(orders.length,1);
  assert.match(panel().textContent,/Estado 60%/);const first=containerLootPreview(battle,battle.units[0],ref,0,1).action;assert.equal(pickup().textContent,`Recoger · ${formatAP(containerLootPreview(battle,battle.units[0],ref,0,1).pa)} PA`);
  await act(async()=>pickup().click());assert.deepEqual(orders[1],first);await draw();
  assert.deepEqual(battle.props[0].contents,[shirt]);assert.equal(pickup().disabled,true);assert.match(pickup().title,/Cambió el objeto/);assert.equal(panel().querySelector('[aria-label="Objeto del cofre"]').value,'-1');
  await act(async()=>pickup().click());assert.equal(orders.length,2);
  const before=structuredClone(battle),stale=actBattle(battle,first);assert.match(stale.lastError,/Cambió el objeto/);for(const key of ['units','props','seed','elapsedSeconds'])assert.deepEqual(stale[key],before[key]);
  await act(async()=>{const select=panel().querySelector('[aria-label="Objeto del cofre"]');select.value='0';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  assert.equal(pickup().disabled,false);assert.match(panel().textContent,/Estado 75%/);
  const second=containerLootPreview(battle,battle.units[0],ref,0,1).action;await act(async()=>pickup().click());assert.deepEqual(orders[2],second);await draw();
  assert.deepEqual(battle.props[0].contents,[]);assert.match(panel().textContent,/cofre está vacío/);
  for(const source of [crowbar,shirt]){const expected=structuredClone(source);delete expected.item;assert.deepEqual(Object.values(battle.units[0].inventory).find(item=>item.instanceId===source.instanceId),expected);}
  let replay=validateBattleSnapshot(JSON.parse(JSON.stringify(initial)));for(const action of orders)replay=actBattle(replay,{...action,unitId:'p'});assert.deepEqual(replay,battle);
  assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(battle))),battle);assert.equal(battle.units[0].medkits,initial.units[0].medkits);
});

test('the mounted wall panel uses the real paid crowbar action and disables absent or broken tools',async t=>{
  const dom=new JSDOM('<!doctype html><div id="root"></div>');
  const globals={window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true};
  const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const host=dom.window.document.getElementById('root'),root=createRoot(host);
  t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
  const tiles=Array.from({length:56},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0}));
  const wall={id:'crowbar-wall',x:2,y:3,axis:'y',type:'wall',material:'adobe',blocked:true,blocksSight:true};
  const state=createBattle([{id:'p',x:1,y:3,facing:2,activeSlot:'tool',activeTool:'inventory:bar',inventory:{bar:{kind:'tool',toolKey:'crowbar',count:1,condition:72,weight:2.5}}}],
    {width:8,height:7,tiles,wallEdges:[wall],enemies:[{id:'guard',x:7,y:6,patrol:false,overwatch:false}]});
  let result=null,calls=0;
  const draw=async battle=>{
    const model=nearbyEnvironmentModel(battle,battle.units[0]);
    await act(async()=>root.render(h(JA2EnvironmentPanel,{...model,selected:model.target.key,verb:'',busy:false,contentIndex:0,count:1,
      onTarget(){},onVerb(){},onUse(){calls++;result=actBattle(battle,model.preview.action);},onContent(){},onCount(){},onLoot(){}})));
    host.querySelector('details').open=true;
    return {model,button:host.querySelector('button')};
  };
  const {model,button}=await draw(state);
  assert.equal(button.textContent,`${model.preview.label} · ${formatAP(model.preview.pa)} PA`);assert.equal(button.disabled,false);
  assert.match(host.textContent,new RegExp(`Desgaste de la barreta: hasta ${model.preview.toolWear} puntos`));
  assert.ok(host.querySelector('[aria-label="Puerta, cofre o pared cercana"]'));
  assert.doesNotMatch(host.textContent,/\b(Abierto|Cerrado)\b|% de éxito|contenido permanece|cofre está vacío/i);
  assert.equal(host.querySelector('[aria-label="Objeto del cofre"]'),null);
  await act(async()=>button.click());assert.equal(calls,1);assert.equal(result.lastError,null);
  assert.equal(result.units[0].ap,state.units[0].ap-model.preview.pa);
  assert.equal(result.units[0].inventory.bar.condition,state.units[0].inventory.bar.condition-model.preview.toolWear);
  assert.equal(result.wallEdges.find(edge=>edge.id===wall.id).blocked,false);
  for(const inventory of [{},{bar:{...state.units[0].inventory.bar,condition:0}}]){
    const unavailable=structuredClone(state);unavailable.units[0].inventory=inventory;
    const {model,button}=await draw(unavailable);assert.equal(model.preview.valid,false);assert.equal(button.disabled,true);
    assert.equal(button.title,model.preview.reason);await act(async()=>button.click());assert.equal(calls,1,'disabled control cannot dispatch work');
  }
});
