import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle} from '../game/tactical.js';
const {EquipmentInteractionProvider,useEquipmentInteraction}=await import('../web/lib/equipment-drag.ts');
const {default:Inventory,RadarCluster}=await import('../web/app/JA2Inventory.tsx');
const noop=()=>{};
function props(){
 const battle=createBattle([{id:'p',name:'Operador',x:1,y:1,weapon:1805,medkits:3}],{
  width:8,height:8,exploration:true,enemies:[],
  tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'grass',blocked:false,cover:0})),
  upperSurfaces:[{id:'roof',x:2,y:1,tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:0}],
  climbLinks:[{id:'up',kind:'climb',from:{x:1,y:1,tacticalLevel:0},to:{x:2,y:1,tacticalLevel:1}}],
 });
 return {battle,unit:battle.units[0],units:battle.units,selected:'p',mode:'move',showSight:false,busy:false,missionAllies:[],localMilitia:[],vw:500,vh:400,project:(x,y)=>({x:x*26,y:y*14}),cameraRect:{x:0,y:0,width:200,height:150},zoom:2,cursorLevel:0,onCursorLevelChange:noop,onOrder:noop,onMode:noop,onToggleSight:noop,onSelect:noop,onRetreat:noop,onCameraCenter:noop,onCameraPan:noop,onZoom:noop,onCloseInventory:noop};
}

test('inventory height and radar controls share the field reservation scope without exempting other controls',()=>{
 let store;
 function Capture(){store=useEquipmentInteraction().store;return null;}
 const html=render(h(EquipmentInteractionProvider,null,[h(Capture,{key:'scope'}),h(Inventory,{key:'inventory',...props()})]));
 const height=html.match(/<button\b[^>]*aria-label="Cambiar altura del cursor"[^>]*>/)?.[0];
 assert.ok(height);assert.ok(height.includes(`data-equipment-scope="${store.scope}"`));
 const radar=html.match(/<div class="ja2-radar" data-equipment-scope="([^"]+)">([\s\S]*?)<\/div><div class="ja2-locale">/);
 assert.ok(radar,'the existing radar div must contain the minimap and camera controls');assert.equal(radar[1],store.scope);
 for(const label of ['Desplazar cámara a la izquierda','Desplazar cámara hacia arriba','Centrar cámara en el combatiente seleccionado','Desplazar cámara hacia abajo','Desplazar cámara a la derecha','Alejar campo','Acercar campo'])assert.ok(radar[2].includes(`aria-label="${label}"`),label);
 assert.match(radar[2],/<svg\b/,'the minimap must share the navigation scope');
 // Capture-phase outside cancellation must still see unrelated actions as
 // outside. In particular, climbing is an order, not cursor navigation.
 for(const className of ['ja2-inventory','ja2-elevation-controls','ja2-right','ja2-inventory-extra']){
  const tag=html.match(new RegExp(`<[^>]+class="${className}"[^>]*>`))?.[0];assert.ok(tag,className);assert.doesNotMatch(tag,/data-equipment-scope/);
 }
 for(const button of html.matchAll(/<button\b[^>]*>[^<]*(?:Subir|Salir del sector|Listo)[^<]*<\/button>/g))assert.doesNotMatch(button[0],/data-equipment-scope/);
 assert.match(html,/>Subir/);
});

test('the ordinary roster radar remains usable outside an equipment provider',()=>{
 const html=render(h(RadarCluster,props()));assert.match(html,/class="ja2-radar"/);assert.doesNotMatch(html,/data-equipment-scope/);
});
