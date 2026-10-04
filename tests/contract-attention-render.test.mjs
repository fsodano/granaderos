import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h,act} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';import {initialCampaign as freshCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {restoredCaptiveContract} from '../game/prisoner-custody.js';
import {contractStatus,contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {decodeSave,encodeSave} from '../game/save.js';
const {default:ContractAttention}=await import('../web/app/ContractAttention.tsx');
const children=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(children)];
const field=()=>dispatchCampaign(dispatchCampaign(initialCampaign(),{type:'recruitCivic',id:103,term:'day'}),{type:'wait',hours:24});
const props=s=>({state:s,roster:rosterFor(s),dispatch:()=>{}});
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
const saved=s=>decodeSave(encodeSave(s)).campaign;
const advanceTo=(s,target)=>{for(let i=0;i<100&&s.hour*3600+(s.secondOfHour??0)<target;i++)s=order(s,{type:'advanceStrategicTime',seconds:Math.min(3600,target-s.hour*3600-(s.secondOfHour??0))});assert.equal(s.hour*3600+(s.secondOfHour??0),target);return s;};
async function mountContractControl(t,state,view='attention'){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://granaderos.test',pretendToBeVisual:true});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Element:dom.window.Element,Node:dom.window.Node,Document:dom.window.Document,ShadowRoot:dom.window.ShadowRoot,MutationObserver:dom.window.MutationObserver,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window),IS_REACT_ACT_ENVIRONMENT:true};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 const {default:StrategicPersonnelMenu}=await import('../web/app/StrategicPersonnelMenu.tsx'),{createRoot}=await import('../web/node_modules/react-dom/client.js');
 const root=createRoot(dom.window.document.getElementById('root'));let current=state;const actions=[];
 const show=()=>{const controlProps={state:current,roster:rosterFor(current),dispatch:a=>{actions.push(a);current=order(current,a);show();}};root.render(view==='attention'?h(ContractAttention,controlProps):h(StrategicPersonnelMenu,{...controlProps,id:103,kind:'contract',onClose:()=>root.render(null)}));};
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 await act(async()=>show());
 return {doc:dom.window.document,state:()=>current,actions,
  async replace(next){await act(async()=>{current=next;show();});},
  async click(button){assert.ok(button);assert.equal(button.disabled,false);await act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));},
 };
}
test('the notice gives the exact remaining time and an ordinary guarded renewal action',()=>{
 const s=field();const html=render(h(ContractAttention,props(s)));assert.match(html,/Avance detenido por contratos/);assert.match(html,/22 de 24 horas solicitadas/);assert.match(html,/termina en 2 horas/);assert.match(html,/Para continuar sin renovar/);
 let sent;const tree=ContractAttention({...props(s),dispatch:a=>sent=a}),button=children(tree).find(n=>n.type==='button');assert.equal(button.props.disabled,false);button.props.onClick();assert.deepEqual(sent,{type:'renewContract',id:103,term:'day',expectedExpiresAt:24,expectedExpiresSecond:0});
 const n=dispatchCampaign(s,sent);assert.equal(n.lastError,null);const renewed=render(h(ContractAttention,props(n)));assert.match(renewed,/ya fue renovado/);assert.doesNotMatch(renewed,/<button/);
});
test('funds and contact disable renewal with a reason; removed soldiers have no stale button',()=>{
 let s=field();s.resources.treasury=0;let html=render(h(ContractAttention,props(s)));assert.match(html,/disabled="" title="No hay suficientes pesos/);
 s.resources.treasury=10000;s.pendingEncounter={groupId:'pending'};html=render(h(ContractAttention,props(s)));assert.match(html,/disabled="" title="Resolvé el encuentro/);
 s=dispatchCampaign(field(),{type:'wait',hours:6});html=render(h(ContractAttention,props(s)));assert.match(html,/Ya no está en servicio/);assert.doesNotMatch(html,/<button/);
});
test('the operations map integrates the contract notice next to its time controls',async()=>{
 const {default:Campaign}=await import('../web/app/Campaign.tsx');const html=render(h(Campaign,{state:field(),dispatch:()=>{},onBattle:()=>{},onOpenDesk:()=>{}}));assert.match(html,/aria-label="Velocidad del tiempo"/);assert.match(html,/>▶ Iniciar<\/button>/);assert.doesNotMatch(html,/aria-label="Tiempo a avanzar"/);assert.match(html,/aria-label="Avisos de contratos"/);assert.match(html,/termina en 2 horas/);
});

test('a restored forty-second contract notice preserves paid service, exact time and guarded renewal identity',async t=>{
 // A declared capture/release record has forty paid seconds left. The notice
 // and renewal use the real reducer; no extension is granted by the fixture.
 let s=field();const captive={captured:true,capturedAt:24,capturedAtSecond:3590,capturedContract:{...s.contracts[103],expiresAt:25,expiresSecond:30}};
 s.hour=500;s.secondOfHour=15;s.contracts[103]=restoredCaptiveContract(captive,500,15);
 s=dispatchCampaign(s,{type:'advanceStrategicTime',seconds:1});assert.equal(s.lastError,null,s.lastError);
 assert.equal(s.hour,500);assert.equal(s.secondOfHour,15);assert.equal(contractStatus(s,103).active,true);assert.equal(contractStatus(s,103).remaining,40/3600);
 s=saved(s);const m=await mountContractControl(t,s);
 assert.match(m.doc.body.textContent,/20:00:15/);assert.match(m.doc.body.textContent,/termina en 40 segundos/);assert.doesNotMatch(m.doc.body.textContent,/El contrato terminó/);
 const quote=contractQuote(s,rosterFor(s).find(o=>o.id===103),'day');await m.click(m.doc.querySelector('button'));
 const sent=m.actions[0];
 assert.deepEqual(sent,{type:'renewContract',id:103,term:'day',expectedExpiresAt:500,expectedExpiresSecond:55});
 const renewed=m.state();assert.deepEqual(renewed,order(saved(s),sent));assert.equal(renewed.resources.treasury,s.resources.treasury-quote.price);assert.equal(renewed.contracts[103].expiresAt,524);assert.equal(renewed.contracts[103].expiresSecond,55);assert.deepEqual(saved(renewed),renewed);
 assert.match(m.doc.body.textContent,/ya fue renovado/);assert.equal(m.doc.querySelector('button'),null);
 const changed=structuredClone(s);changed.contracts[103].expiresSecond=56;
 await m.replace(changed);assert.match(m.doc.body.textContent,/ya fue renovado/);assert.equal(m.doc.querySelector('button'),null);
 const stale=dispatchCampaign(changed,sent);assert.match(stale.lastError,/contrato cambió/);assert.equal(stale.resources.treasury,changed.resources.treasury);assert.deepEqual(stale.contracts,changed.contracts);
});

test('mounted paid renewals extend exact saved service while their reward waits a full twenty-four hours',async t=>{
 // The real paid hire starts at 00:00:17. Every later payment uses the ordinary
 // guarded menu; a renewal buys service even while its morale reward waits.
 let s=order(freshCampaign(),{type:'advanceStrategicTime',seconds:17});s=order(s,{type:'recruitCivic',id:103,term:'week'});s=saved(advanceTo(s,25199));
 assert.equal(s.hour,6);assert.equal(s.secondOfHour,3599);assert.ok(s.recruited.includes(103));assert.equal(s.contracts[103].startedSecond,17);assert.equal(s.operativeState[103].lastMoralePayAt,null);
 const initialMorale=s.operativeState[103].morale,initialStanding=s.reputation.foreign,m=await mountContractControl(t,s,'contract');
 const renew=async(start)=>{
  start=saved(start);await m.replace(start);const expiry=contractExpiresSeconds(start.contracts[103]),quote=contractQuote(start,rosterFor(start).find(o=>o.id===103),'day');
  const button=[...m.doc.querySelectorAll('button')].find(b=>b.textContent.startsWith('Un día'));
  assert.match(button.textContent,new RegExp(`${quote.price.toLocaleString('es-AR')} pesos`));await m.click(button);
  const action=m.actions.at(-1);assert.deepEqual(action,{type:'renewContract',id:103,term:'day',expectedExpiresAt:start.contracts[103].expiresAt,expectedExpiresSecond:17});
  const next=m.state();assert.equal(next.resources.treasury,start.resources.treasury-quote.price);assert.equal(contractExpiresSeconds(next.contracts[103]),expiry+86400);assert.equal(next.contracts[103].expiresSecond,17);assert.deepEqual(next,order(saved(start),action));assert.deepEqual(saved(next),next);
  const stale=dispatchCampaign(next,action);assert.match(stale.lastError,/contrato cambió/);assert.deepEqual({...stale,lastError:null},next);
  return next;
 };
 s=await renew(s);assert.equal(s.operativeState[103].morale,initialMorale+2);assert.equal(s.reputation.foreign,initialStanding+5);assert.equal(s.operativeState[103].lastMoralePayAt,6);assert.equal(s.operativeState[103].lastMoralePaySecond,3599);
 s=await renew(advanceTo(saved(s),108000));assert.equal(s.hour,30);assert.equal(s.secondOfHour,0);assert.equal(s.operativeState[103].morale,initialMorale+2);assert.equal(s.reputation.foreign,initialStanding+5);assert.equal(s.operativeState[103].lastMoralePayAt,6);assert.equal(s.operativeState[103].lastMoralePaySecond,3599);
 s=await renew(advanceTo(saved(s),111599));assert.equal(s.hour,30);assert.equal(s.secondOfHour,3599);assert.equal(s.operativeState[103].morale,initialMorale+4);assert.equal(s.reputation.foreign,initialStanding+10);assert.equal(s.operativeState[103].lastMoralePayAt,30);assert.equal(s.operativeState[103].lastMoralePaySecond,3599);
});
