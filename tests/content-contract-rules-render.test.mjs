import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {DEFAULT_CONTRACT_RULES} from '../game/contract-rules.js';
import {contractQuote,contractStatus,contractExpiresSeconds} from '../game/contracts.js';
const {default:ContractRules}=await import('../web/app/story/ContractRules.tsx');
const {default:Recruitment}=await import('../web/app/Recruitment.tsx');
const {default:ContractAttention}=await import('../web/app/ContractAttention.tsx');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];

test('contract editor writes only the selected rule and restores optional defaults',()=>{
 const draft=defaultContentPackage();let changed;
 const tree=ContractRules({draft,onChange:next=>changed=next}),inputs=nodes(tree).filter(n=>n.type==='input');assert.equal(inputs.length,7);
 inputs[0].props.onChange({target:{valueAsNumber:2}});assert.equal(changed.contractRules.days.day,2);assert.equal(changed.contractRules.days.week,7);assert.equal(draft.contractRules,undefined);assert.deepEqual(validateContentPackage(changed),[]);
 const edited=ContractRules({draft:changed,onChange:next=>changed=next});nodes(edited).find(n=>n.type==='button').props.onClick();assert.equal(changed.contractRules,undefined);assert.deepEqual(changed,draft);
 const html=render(h(ContractRules,{draft,onChange:()=>{}}));assert.match(html,/Contratos y paga/);assert.match(html,/incluidos los especialistas de élite/);
});

test('hiring choices display the active campaign periods',()=>{
 const draft=defaultContentPackage();draft.contractRules={...DEFAULT_CONTRACT_RULES,days:{day:2,week:10,month:40}};
 const html=render(h(Recruitment,{state:initialCampaign(42,draft),dispatch:()=>{}}));
 for(const [term,label]of [['day','2 días'],['week','10 días'],['fortnight','Dos semanas']])assert.match(html,new RegExp(`value="${term}"[^>]*>${label}</option>`));
 assert.doesNotMatch(html,/value="month"/);
});

test('renewal notices show authored labels and submit the corresponding stable term',()=>{
 const draft=defaultContentPackage();draft.contractRules={...DEFAULT_CONTRACT_RULES,days:{day:1,week:10,month:40},warningHours:4};draft.characters.find(c=>c.id==='person-110').arrivalHours=0;
 let s=dispatchCampaign(initialCampaign(42,draft),{type:'recruitCivic',id:110,term:'day'});s=dispatchCampaign(s,{type:'wait',hours:24});assert.equal(s.lastError,null);
 let sent;const props={state:s,roster:rosterFor(s),dispatch:a=>sent=a};const html=render(h(ContractAttention,props));assert.match(html,/10 días/);assert.match(html,/termina en 4 horas/);
 const button=nodes(ContractAttention(props)).find(n=>n.type==='button'&&n.key==='week');assert.ok(button);button.props.onClick();assert.equal(sent.term,'week');
 const renewed=dispatchCampaign(s,sent);assert.equal(renewed.lastError,null);assert.equal(renewed.contracts[110].expiresAt,264);
});

test('local character preview shows authored prices and contract labels',async()=>{
 const {default:ContractPricePreview}=await import('../web/app/story/ContractPricePreview.tsx');
 const draft={contractRules:{...DEFAULT_CONTRACT_RULES,days:{day:2,week:10,month:40},salaryMonthDays:20}};
 const html=render(h(ContractPricePreview,{draft,monthlyPay:600}));assert.match(html,/2 días: 360 pesos; 10 días: 1800 pesos; 40 días: 7200 pesos; dos semanas: 2520 pesos/);
});

test('the dossier receives the active campaign daily rate instead of a baseline quote',async()=>{
 const {default:CharacterDossier}=await import('../web/app/CharacterDossier.tsx');
 const draft=defaultContentPackage();draft.contractRules={...DEFAULT_CONTRACT_RULES,salaryMonthDays:20};draft.characters.find(c=>c.id==='person-110').monthlyPay=600;
 const state=initialCampaign(42,draft),operative=rosterFor(state).find(o=>o.id===110);state.operativeState[110].xp=100;
 const tree=CharacterDossier({state,operative,record:state.operativeState[110],onClose:()=>{}});
 assert.ok(nodes(tree).some(n=>n.type==='p'&&n.props.children==='198 pesos por día'));
});

test('hired cards show short remaining time after real seconds without changing exact paid service',()=>{
 const draft=defaultContentPackage();draft.characters.find(c=>c.id==='person-110').arrivalHours=0;assert.deepEqual(validateContentPackage(draft),[]);
 let state=initialCampaign(42,draft);const op=rosterFor(state).find(o=>o.id===110),quote=contractQuote(state,op,'day'),cash=state.resources.treasury;
 state=dispatchCampaign(state,{type:'recruitCivic',id:110,term:'day'});assert.equal(state.lastError,null);assert.equal(state.resources.treasury,cash-quote.total);assert.equal(state.contracts[110].paid,quote.price);
 const contract=structuredClone(state.contracts[110]),clock=s=>s.hour*3600+(s.secondOfHour??0);assert.equal(quote.hours,24);assert.equal(contractExpiresSeconds(contract),86400);
 for(const [elapsed,label]of [[0,'24 h'],[374,'23 h 54 min'],[86370,'1 min']]){
  for(let n=0;clock(state)<elapsed&&n<40;n++){state=dispatchCampaign(state,{type:'advanceStrategicTime',seconds:Math.min(3600,elapsed-clock(state))});assert.equal(state.lastError,null);}
  assert.equal(clock(state),elapsed);assert.equal(contractStatus(state,110).remaining,(86400-elapsed)/3600);assert.equal(contractStatus(state,110).active,true);assert.deepEqual(state.contracts[110],contract);assert.equal(state.resources.treasury,cash-quote.total);
  const before=structuredClone(state),sent=[],html=render(h(Recruitment,{state,dispatch:action=>sent.push(action)})),card=html.match(/<article[^>]*data-operative-id="110"[^>]*>([\s\S]*?)<\/article>/)?.[1];assert.ok(card);
  assert.equal(card.match(/<p class="contract-remaining">([^<]*)<\/p>/)?.[1],`${label} de contrato restantes`);assert.doesNotMatch(card,/\d+\.\d+ horas de contrato restantes/);assert.deepEqual(sent,[]);assert.deepEqual(state,before,'Rendering cannot round or mutate Native contract time, prices or campaign state.');
 }
});
