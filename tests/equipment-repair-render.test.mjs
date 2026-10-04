import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {withCarriedRepairKit} from './commerce-gear-fixture.mjs';
import {visit} from './local-contract-fixture.mjs';
import {createBattle,actBattle,presentedActBattle,firearmMaintenancePreview} from '../game/tactical.js';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {unitAmmunitionByType} from '../game/campaign-ammunition.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
const {default:MedicalCare}=await import('../web/app/MedicalCare.tsx');
const {default:Inventory}=await import('../web/app/JA2Inventory.tsx');
const draw=state=>render(h(MedicalCare,{state,sectorId:'retiro',dispatch:()=>{}}));

test('new personnel controls default to carried equipment and show the actual damaged tool queue',()=>{
  const state=initialCampaign();state.operativeState[10].inventory={pliers:{itemType:'tool',toolKey:'pliers',condition:61,count:1,weight:.4}};
  const before=structuredClone(state),markup=draw(state);
  assert.match(markup,/value="equipment" selected="">Todo el equipo llevado/);
  assert.match(markup,/Orden de reparación de Paroissien/);assert.match(markup,/Alicates · 61%/);
  assert.match(markup,/Secundaria → principal y bayoneta → mochila/);assert.deepEqual(state,before);
});

test('legacy gun-only assignments retain their saved scope instead of silently expanding their work',()=>{
  const state=initialCampaign();Object.assign(state.operativeState[10],{assignment:'repair',repairTargetId:4,repairWeaponId:1808,toolkitPoints:100});state.operativeState[4].condition=80;
  assert.match(draw(state),/value="primary" selected="">Solo el arma principal actual/);
});

async function mountInventory(t,initial,id=initial.units[0].id){
  const dom=new JSDOM('<!doctype html><div id="root"></div>'),globals={window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true};
  const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  const host=dom.window.document.getElementById('root'),root=createRoot(host),noop=()=>{},orders=[];let battle=initial;
  t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
  const paint=async(next=battle)=>{
    battle=next;const unit=battle.units.find(actor=>actor.id===id);
    await act(async()=>root.render(h(Inventory,{battle,unit,units:battle.units,selected:id,mode:'move',showSight:false,busy:false,missionAllies:[],localMilitia:[],vw:600,vh:400,cameraRect:{x:0,y:0,width:200,height:150},project:(x,y)=>({x:x*26,y:y*14}),zoom:1,
      onOrder:action=>{orders.push(action);const before=battle;const ordinary=actBattle(before,action);assert.equal(ordinary.lastError,null,ordinary.lastError);assert.deepEqual(presentedActBattle(before,action).state,ordinary);battle=ordinary;},
      onMode:noop,onToggleSight:noop,onSelect:noop,onRetreat:noop,onCameraCenter:noop,onCameraPan:noop,onZoom:noop,onCloseInventory:noop})));
    const details=[...host.querySelectorAll('details')].find(node=>node.querySelector('summary')?.textContent==='Postura y órdenes');details.open=true;
  };
  await paint();return {host,orders,paint,get battle(){return battle;},get button(){return host.querySelector('button[aria-label="Mantener arma"]');}};
}

test('the real inventory maintenance consumes its declared finite kit and survives official save replay without changing ammunition',async t=>{
  // Prepared subsystem: existing service and the finite used-gun kit are
  // declared before the ordinary visit. This is not an acquisition route.
  const prepared=withCarriedRepairKit(initialCampaign(45),4,17);prepared.operativeState[4].condition=60;
  const start=visit(prepared),source=start.battle.units.find(unit=>unit.id==='4'),before=structuredClone(start),ammo=unitAmmunitionByType(source),preview=firearmMaintenancePreview(start.battle,source);
  const ui=await mountInventory(t,start.battle,'4');assert.equal(ui.button.disabled,false);assert.equal(ui.button.textContent,'Mantener arma · sin PA');
  assert.match(ui.host.textContent,/Estado \+17 puntos.*materiales: 17 puntos/);assert.doesNotMatch(ui.host.textContent,/Cambiar sílex/);assert.deepEqual(start,before,'viewing the finite preview is read only');
  await act(async()=>ui.button.click());assert.deepEqual(ui.orders,[preview.action]);
  const unit=ui.battle.units.find(unit=>unit.id==='4');assert.equal(unit.condition,77);assert.equal(repairMaterialPoints(unit),0);assert.equal(unit.inventory['fixture:repair-kit'],undefined);
  assert.deepEqual(unitAmmunitionByType(unit),ammo);assert.equal(unit.loaded,source.loaded);assert.equal(unit.ap,source.ap);assert.equal(ui.battle.elapsedSeconds-start.battle.elapsedSeconds,Math.max(1,Math.ceil(preview.pa*.06)));
  for(const key of ['hp','energy','jammed'])assert.deepEqual(unit[key],source[key],key);assert.equal(unit.flints,undefined);assert.equal(unit.priming,undefined);
  const sync=syncBattleTime(start.campaign,ui.battle);assert.equal(sync.error,null,sync.error);const saved=decodeSave(encodeSave(sync.campaign,sync.battle));
  assert.deepEqual(saved,{campaign:sync.campaign,battle:sync.battle});
  const replay=actBattle(decodeSave(encodeSave(start.campaign,start.battle)).battle,ui.orders[0]);assert.deepEqual(replay,ui.battle);
  const replaySync=syncBattleTime(start.campaign,replay);assert.equal(replaySync.error,null,replaySync.error);assert.deepEqual(decodeSave(encodeSave(replaySync.campaign,replaySync.battle)),saved);
  await ui.paint(saved.battle);assert.equal(ui.button.disabled,true);assert.match(ui.button.title,/materiales/i);assert.ok(ui.host.textContent.includes(ui.button.title));
  await act(async()=>ui.button.click());assert.equal(ui.orders.length,1);assert.deepEqual(start,before);
});

test('inventory maintenance explains invalid boundaries and still spends a legacy numeric reserve through the actual button',async t=>{
  const field=extra=>validateBattleSnapshot(createBattle([{id:'p',name:'Soldado preparado',x:1,y:2,weapon:1805,loaded:1,ammo:9,condition:60,toolkitPoints:8,...extra}],{width:14,height:8,seed:45,tiles:Array.from({length:112},(_,i)=>({x:i%14,y:Math.floor(i/14),type:'grass',blocked:false,blocksSight:false,cover:0})),enemies:[{id:'e',x:12,y:6,patrol:false,overwatch:false}]}));
  const initial=field({}),ui=await mountInventory(t,initial),before=structuredClone(initial),preview=firearmMaintenancePreview(initial,initial.units[0]);
  assert.equal(ui.button.disabled,false);assert.equal(ui.button.textContent,`Mantener arma · ${preview.pa} PA`);assert.match(ui.host.textContent,/Estado \+8 puntos.*materiales: 8 puntos/);
  await act(async()=>ui.button.click());assert.deepEqual(ui.orders,[preview.action]);assert.equal(ui.battle.units[0].condition,68);assert.equal(ui.battle.units[0].toolkitPoints,0);assert.equal(ui.battle.units[0].ap,initial.units[0].ap-preview.pa);
  assert.deepEqual(unitAmmunitionByType(ui.battle.units[0]),unitAmmunitionByType(initial.units[0]));assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(ui.battle))),ui.battle);assert.deepEqual(initial,before);
  for(const [boundary,reason]of [
    [field({toolkitPoints:0}),/materiales/i],
    [field({condition:100}),/buen estado/i],
    [field({weapon:1813,loaded:0,ammo:0}),/arma de fuego/i],
    [(()=>{const low=field({});low.units[0].ap=preview.pa-1;return low;})(),/PA/],
  ]){
    await ui.paint(boundary);assert.equal(ui.button.disabled,true);assert.match(ui.button.title,reason);assert.ok(ui.host.textContent.includes(ui.button.title));
    const snapshot=structuredClone(ui.battle);await act(async()=>ui.button.click());assert.equal(ui.orders.length,1);assert.deepEqual(ui.battle,snapshot);
  }
});
