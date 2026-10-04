import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {restoredCaptiveContract} from '../game/prisoner-custody.js';
import {contractStatus} from '../game/contracts.js';
import {decodeSave,encodeSave} from '../game/save.js';
const {default:ContractAttention}=await import('../web/app/ContractAttention.tsx');
const children=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(children)];
const field=()=>dispatchCampaign(dispatchCampaign(initialCampaign(),{type:'recruitCivic',id:103,term:'day'}),{type:'wait',hours:24});
const props=s=>({state:s,roster:rosterFor(s),dispatch:()=>{}});
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

test('a restored forty-second contract notice preserves paid service, exact time and guarded renewal identity',()=>{
 // A declared capture/release record has forty paid seconds left. The notice
 // and renewal use the real reducer; no extension is granted by the fixture.
 let s=field();const captive={captured:true,capturedAt:24,capturedAtSecond:3590,capturedContract:{...s.contracts[103],expiresAt:25,expiresSecond:30}};
 s.hour=500;s.secondOfHour=15;s.contracts[103]=restoredCaptiveContract(captive,500,15);
 s=dispatchCampaign(s,{type:'advanceStrategicTime',seconds:1});assert.equal(s.lastError,null,s.lastError);
 assert.equal(s.hour,500);assert.equal(s.secondOfHour,15);assert.equal(contractStatus(s,103).active,true);assert.equal(contractStatus(s,103).remaining,40/3600);
 s=decodeSave(encodeSave(s)).campaign;const html=render(h(ContractAttention,props(s)));
 assert.match(html,/20:00:15/);assert.match(html,/termina en 40 segundos/);assert.doesNotMatch(html,/El contrato terminó/);
 let sent;const tree=ContractAttention({...props(s),dispatch:a=>sent=a}),button=children(tree).find(n=>n.type==='button');button.props.onClick();
 assert.deepEqual(sent,{type:'renewContract',id:103,term:'day',expectedExpiresAt:500,expectedExpiresSecond:55});
 const renewed=dispatchCampaign(s,sent);assert.equal(renewed.lastError,null,renewed.lastError);assert.equal(renewed.contracts[103].expiresAt,524);assert.equal(renewed.contracts[103].expiresSecond,55);
 assert.match(render(h(ContractAttention,props(renewed))),/ya fue renovado/);
 const changed=structuredClone(s);changed.contracts[103].expiresSecond=56;
 assert.match(render(h(ContractAttention,props(changed))),/ya fue renovado/);assert.doesNotMatch(render(h(ContractAttention,props(changed))),/<button/);
 const stale=dispatchCampaign(changed,sent);assert.match(stale.lastError,/contrato cambió/);assert.equal(stale.resources.treasury,changed.resources.treasury);assert.deepEqual(stale.contracts,changed.contracts);
});
