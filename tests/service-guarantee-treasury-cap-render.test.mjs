import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
const CAP=1000000000,id=110,order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
function hire(travel=0,guarantee=101){const d=defaultContentPackage();Object.assign(d.characters.find(c=>c.id==='person-110'),{serviceGuarantee:guarantee,arrivalHours:travel});let s=order(initialCampaign(42,d),{type:'recruitCivic',id});s.resources.treasury=CAP-50;return s;}
function doc(markup){return new JSDOM(markup).window.document;}
function button(document,text){const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);assert.ok(b,text);return b;}

test('public catalogue, personnel and rival controls show the atomic refund headroom reason',async()=>{
 const [{default:Recruitment},{default:Personnel},{default:Refusal}]=await Promise.all([import('../web/app/Recruitment.tsx'),import('../web/app/StrategicPersonnelMenu.tsx'),import('../web/app/ServiceRefusalNotice.tsx')]);const s=hire(),op=rosterFor(s).find(o=>o.id===id);
 const catalogue=doc(render(h(Recruitment,{state:s,dispatch:()=>{}})));const card=catalogue.querySelector(`[data-operative-id="${id}"]`);assert.equal(button(card,'Finalizar servicio').disabled,true);assert.match(card.textContent,/tesorería no tiene espacio para devolver 101 pesos/);assert.match(button(card,'Finalizar servicio').title,/Gastá fondos/);
 const personnel=doc(render(h(Personnel,{state:s,roster:rosterFor(s),id,kind:'contract',onClose:()=>{},dispatch:()=>{}})));assert.equal(button(personnel,'Despedir').disabled,true);assert.match(personnel.body.textContent,/Gastá fondos y volvé a intentarlo/);
 const refusal=doc(render(h(Refusal,{state:s,refusal:{rivalId:id,rivalName:op.name,reason:'Servicio rechazado.'},dispatch:()=>{}})));assert.equal(button(refusal,`Finalizar servicio de ${op.name}`).disabled,true);assert.match(refusal.body.textContent,/devolver 101 pesos/);
 s.resources.treasury=CAP-101;const available=doc(render(h(Personnel,{state:s,roster:rosterFor(s),id,kind:'contract',onClose:()=>{},dispatch:()=>{}})));assert.equal(button(available,'Despedir').disabled,false);assert.doesNotMatch(available.body.textContent,/Gastá fondos/);
});

test('pending arrival control discloses the full salary-plus-guarantee reason and legacy salary guard',async()=>{
 const {default:Recruitment}=await import('../web/app/Recruitment.tsx');
 for(const amount of [101,0]){const s=hire(6,amount),d=doc(render(h(Recruitment,{state:s,dispatch:()=>{}}))),card=d.querySelector(`[data-operative-id="${id}"]`),b=button(card,`Cancelar llegada · recuperar ${60+amount} pesos`);assert.equal(b.disabled,true);assert.match(card.textContent,new RegExp(`devolver ${60+amount} pesos`));s.resources.treasury=CAP-60-amount;const available=doc(render(h(Recruitment,{state:s,dispatch:()=>{}})));assert.equal(button(available.querySelector(`[data-operative-id="${id}"]`),`Cancelar llegada · recuperar ${60+amount} pesos`).disabled,false);}
});

test('public treasury notice distinguishes paid and owed guarantee and disappears after actual spending',async()=>{
 const {default:Treasury}=await import('../web/app/Treasury.tsx');let s=hire();while(s.contracts[id])s=order(s,{type:'wait',hours:Math.max(1,24-s.hour)});const before=render(h(Treasury,{state:s,dispatch:()=>{}}));assert.match(before,/50 pesos abonados; 51 pesos pendientes/);assert.match(before,/Al gastar fondos, se abonará el saldo pendiente/);assert.match(before,/La paga no se devuelve/);
 s=order(s,{type:'recruitCivic',id,term:'day'});const after=render(h(Treasury,{state:s,dispatch:()=>{}}));assert.doesNotMatch(after,/Garantías pendientes|pesos pendientes/);assert.equal(s.serviceGuarantees.entries['guarantee-1'].creditedRefund,101);assert.equal(s.contracts[id].guaranteeId,'guarantee-2');
 const legacy=render(h(Treasury,{state:initialCampaign(42),dispatch:()=>{}}));assert.doesNotMatch(legacy,/Garantías pendientes/);
});
