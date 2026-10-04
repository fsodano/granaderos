// Explicit composition for retained, unused widget tests. The ordinary app
// never mounts this panel; all callbacks still use the public campaign reducer.
import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {dispatchCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {leave} from './local-contract-fixture.mjs';
export async function mountLegacyArmory(t,pair){
 const initial=pair.battle?leave(pair):pair.campaign??pair;
 let current=decodeSave(encodeSave(initial)).campaign,key=0;
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test'}),document=dom.window.document;
 const globals={window:dom.window,document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));for(const[name,value]of Object.entries(globals))Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
 const {default:Armory}=await import('../web/app/Armory.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js'),root=createRoot(document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const[name,value]of previous){if(value)Object.defineProperty(globalThis,name,value);else delete globalThis[name];}}});
 const draw=()=>{dom.window.localStorage.setItem('fixture-save',encodeSave(current));root.render(h(Armory,{key,state:current,dispatch:action=>{current=dispatchCampaign(current,action);draw();}}));};
 const click=async text=>{const button=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')??b.textContent.trim()).startsWith(text));assert.ok(button,text);await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 await act(async()=>draw());
 return {dom,document,click,read:()=>({campaign:current}),saved:()=>decodeSave(dom.window.localStorage.getItem('fixture-save')),remount:async()=>act(async()=>{key++;draw();})};
}
