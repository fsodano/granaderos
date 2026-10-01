import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';import {dispatchCampaign,rosterFor} from '../game/campaign.js';
const {default:ContractAttention}=await import('../web/app/ContractAttention.tsx');
const children=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(children)];
const field=()=>dispatchCampaign(dispatchCampaign(initialCampaign(),{type:'recruitCivic',id:103,term:'day'}),{type:'wait',hours:24});
const props=s=>({state:s,roster:rosterFor(s),dispatch:()=>{}});
test('the notice gives the exact remaining time and an ordinary guarded renewal action',()=>{
 const s=field();const html=render(h(ContractAttention,props(s)));assert.match(html,/Avance detenido por contratos/);assert.match(html,/22 de 24 horas solicitadas/);assert.match(html,/termina en 2 horas/);assert.match(html,/Para continuar sin renovar/);
 let sent;const tree=ContractAttention({...props(s),dispatch:a=>sent=a}),button=children(tree).find(n=>n.type==='button');assert.equal(button.props.disabled,false);button.props.onClick();assert.deepEqual(sent,{type:'renewContract',id:103,term:'day',expectedExpiresAt:24});
 const n=dispatchCampaign(s,sent);assert.equal(n.lastError,null);const renewed=render(h(ContractAttention,props(n)));assert.match(renewed,/ya fue renovado/);assert.doesNotMatch(renewed,/<button/);
});
test('funds and contact disable renewal with a reason; removed soldiers have no stale button',()=>{
 let s=field();s.resources.treasury=0;let html=render(h(ContractAttention,props(s)));assert.match(html,/disabled="" title="No hay suficientes pesos/);
 s.resources.treasury=10000;s.pendingEncounter={groupId:'pending'};html=render(h(ContractAttention,props(s)));assert.match(html,/disabled="" title="Resolvé el encuentro/);
 s=dispatchCampaign(field(),{type:'wait',hours:6});html=render(h(ContractAttention,props(s)));assert.match(html,/Ya no está en servicio/);assert.doesNotMatch(html,/<button/);
});
test('the operations map integrates the contract notice next to its time controls',async()=>{
 const {default:Campaign}=await import('../web/app/Campaign.tsx');const html=render(h(Campaign,{state:field(),dispatch:()=>{},onBattle:()=>{},onOpenDesk:()=>{}}));assert.match(html,/aria-label="Tiempo a avanzar"/);assert.match(html,/aria-label="Avisos de contratos"/);assert.match(html,/termina en 2 horas/);
});
