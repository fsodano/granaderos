import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.node.js';
import {createBattle} from '../game/tactical.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:CampaignReturn}=await import('../web/app/JA2CampaignReturn.tsx');

// Mount the real controller without requiring the separate movement-worker test harness.
async function mountBattlefield(t,Battlefield,props){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{pretendToBeVisual:true});
 class Worker{postMessage(){}terminate(){}}
 const globals={window:dom.window,document:dom.window.document,Worker,IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window)};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 let tree;const wrapper=Battlefield(props),content=wrapper.props.children;
 function Capture(){tree=content.type(content.props);return null;}
 const root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 await act(async()=>root.render(h(wrapper.type,null,h(Capture))));
 return {tree:()=>tree,act};
}
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
const withClass=(tree,name)=>nodes(tree).find(node=>node.props?.className?.split(' ').includes(name));
const text=node=>typeof node==='string'||typeof node==='number'?String(node):!node||typeof node!=='object'?'':(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).map(text).join('');
const battle=()=>createBattle([{id:'p',name:'Granadero',x:15,y:15}],{width:40,height:40,exploration:true,enemies:[],sectorName:'Buenos Aires · Fuerte y Retiro'});

test('one compact header keeps return and status above the map with camera and help closed',async t=>{
 const mounted=await mountBattlefield(t,Battlefield,{battle:battle(),peacefulVisit:true,onChange(){},onFinish(){}});
 const tree=mounted.tree(),toolbar=withClass(tree,'tactical-map-toolbar'),middle=withClass(tree,'battle-middle');
 assert.ok(toolbar);assert.ok(middle);assert.equal(toolbar.type,'header');
 assert.equal(nodes(tree).filter(node=>node.props?.className?.split(' ').includes('battle-header')).length,1);
 assert.ok(tree.props.children.indexOf(toolbar)<tree.props.children.indexOf(middle));
 assert.equal(withClass(toolbar,'ja2-group-hint'),undefined);
 assert.equal(withClass(toolbar,'map-order-help'),undefined);
 assert.equal(nodes(toolbar).find(node=>node.type===CampaignReturn)?.props.compact,true);
 assert.equal(withClass(middle,'ja2-group-hint'),undefined);
 assert.equal(nodes(middle).some(node=>node.type===CampaignReturn),false);
 const html=renderToStaticMarkup(toolbar);
 assert.match(html,/aria-label="Volver a la campaña"/);assert.match(html,/>← Campaña<\/button>/);
 assert.equal(nodes(toolbar).filter(node=>node.type==='h1').length,1);
 for(const id of ['tactical-camera-panel','tactical-key-reference']){
  assert.equal(nodes(toolbar).find(node=>node.type==='button'&&node.props['aria-controls']===id)?.props['aria-expanded'],false);
  assert.equal(nodes(toolbar).find(node=>node.props?.id===id),undefined);
 }
 assert.doesNotMatch(text(toolbar),/Mayús|seleccionar un grupo|La escuadra permanece/);
 assert.equal(text(withClass(toolbar,'map-order-mode')),'Mover');
 assert.doesNotMatch(html,/role="group" aria-label="Cámara del campo"|aria-label="Escala del campo"/);
 assert.match(text(withClass(tree,'battle-header')),/Exploración libre/);
 assert.match(text(withClass(tree,'battle-header')),/0 avistados/);
});

test('toolbar camera and zoom controls preserve navigation without submitting an order',async t=>{
 const orders=[];
 const mounted=await mountBattlefield(t,Battlefield,{battle:battle(),peacefulVisit:true,onChange:order=>orders.push(order),onFinish(){}});
 const toolbar=()=>withClass(mounted.tree(),'tactical-map-toolbar');
 const button=label=>nodes(toolbar()).find(node=>node.type==='button'&&node.props['aria-label']===label);
 const camera=()=>nodes(mounted.tree()).find(node=>node.props?.['data-scene-camera'])?.props.transform??svg().props.viewBox;
 const svg=()=>withClass(mounted.tree(),'tactical-field');
 const cameraToggle=()=>nodes(toolbar()).find(node=>node.type==='button'&&node.props['aria-controls']==='tactical-camera-panel');
 assert.equal(cameraToggle().props['aria-expanded'],false);assert.equal(button('Centrar cámara en el combatiente seleccionado'),undefined);
 await mounted.act(async()=>cameraToggle().props.onClick());assert.equal(cameraToggle().props['aria-expanded'],true);
 const openMarkup=renderToStaticMarkup(toolbar());assert.match(openMarkup,/role="group" aria-label="Cámara del campo"/);assert.match(openMarkup,/role="group" aria-label="Zoom del campo"/);assert.match(openMarkup,/aria-label="Escala del campo"/);
 await mounted.act(async()=>button('Centrar cámara en el combatiente seleccionado').props.onClick());
 const initialCamera=camera(),initialView=svg().props.viewBox;
 await mounted.act(async()=>button('Desplazar cámara a la derecha').props.onClick());
 assert.notEqual(camera(),initialCamera);
 await mounted.act(async()=>button('Centrar cámara en el combatiente seleccionado').props.onClick());
 assert.equal(camera(),initialCamera);
 for(const label of ['Desplazar cámara a la izquierda','Desplazar cámara hacia arriba','Desplazar cámara hacia abajo'])assert.equal(typeof button(label).props.onClick,'function');
 assert.equal(button('Acercar campo').props.disabled,false);
 await mounted.act(async()=>button('Acercar campo').props.onClick());
 assert.notEqual(svg().props.viewBox,initialView);
 assert.match(renderToStaticMarkup(toolbar()),/>300%<\/output>/);
 assert.equal(button('Acercar campo').props.disabled,true);
 await mounted.act(async()=>button('Alejar campo').props.onClick());
 assert.equal(svg().props.viewBox,initialView);
 await mounted.act(async()=>document.body.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 assert.equal(cameraToggle().props['aria-expanded'],false);assert.equal(button('Centrar cámara en el combatiente seleccionado'),undefined);
 assert.deepEqual(orders,[]);
});

test('the compact return action and keyboard reference remain usable',async t=>{
 let returns=0;
 const mounted=await mountBattlefield(t,Battlefield,{battle:battle(),peacefulVisit:true,onChange(){},onFinish(){returns++;}});
 const returnNode=nodes(mounted.tree()).find(node=>node.type===CampaignReturn);
 const returnButton=nodes(CampaignReturn(returnNode.props)).find(node=>node.type==='button');
 assert.equal(returnNode.props.compact,true);assert.equal(returnButton.props.disabled,false);assert.equal(returnButton.props['aria-label'],'Volver a la campaña');assert.equal(text(returnButton),'← Campaña');assert.match(returnButton.props.title,/La escuadra permanece/);
 returnButton.props.onClick();assert.equal(returns,1);
 const help=()=>nodes(mounted.tree()).find(node=>node.type==='button'&&node.props['aria-controls']==='tactical-key-reference');
 assert.equal(help().props['aria-expanded'],false);
 await mounted.act(async()=>help().props.onClick());
 assert.equal(help().props['aria-expanded'],true);
 assert.ok(nodes(mounted.tree()).some(node=>node.props?.id==='tactical-key-reference'));
 const reference=()=>nodes(mounted.tree()).find(node=>node.props?.id==='tactical-key-reference');
 assert.match(text(reference()),/Mayús.*seleccionar un grupo/);assert.ok(withClass(reference(),'map-order-help'));
 const key=async key=>mounted.act(async()=>document.body.dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true})));
 await key('Escape');assert.equal(help().props['aria-expanded'],false);assert.equal(reference(),undefined);
 await key('h');assert.equal(help().props['aria-expanded'],true);
 const camera=()=>nodes(mounted.tree()).find(node=>node.type==='button'&&node.props['aria-controls']==='tactical-camera-panel');
 await mounted.act(async()=>camera().props.onClick());assert.equal(camera().props['aria-expanded'],true);assert.equal(help().props['aria-expanded'],false);
 await key('h');assert.equal(help().props['aria-expanded'],true);assert.equal(camera().props['aria-expanded'],false);
 await key('Escape');assert.equal(help().props['aria-expanded'],false);assert.equal(reference(),undefined);
});
