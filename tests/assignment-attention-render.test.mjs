import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {publicAssignmentNotice,assignmentAttentionText} from '../game/assignment-attention.js';
const {default:AssignmentAttention}=await import('../web/app/AssignmentAttention.tsx');
const {default:Campaign}=await import('../web/app/Campaign.tsx');
const noop=()=>{};
const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null);return next;};
const draw=state=>render(h(AssignmentAttention,{state,roster:rosterFor(state)}));
const textOnly=markup=>markup.replace(/<[^>]*>/g,'');

test('assignment status is absent until an explicit advance has a notice',()=>{
 const state=initialCampaign();assert.equal(draw(state),'');
 const resting=order(state,{type:'assignCare',operativeId:3,assignment:'rest'});
 assert.equal(draw(resting),'','an assignment change alone does not create a pause notice');
});

test('a preflight assignment pause reports zero elapsed hours and keeps resume in the existing advance control',()=>{
 let state=order(initialCampaign(),{type:'assignCare',operativeId:3,assignment:'rest'});
 state=order(state,{type:'wait',hours:24});
 const notice=publicAssignmentNotice(state);assert.equal(notice.advancedHours,0);assert.equal(notice.requestedHours,24);
 const markup=draw(state),text=textOnly(markup);
 assert.match(markup,/role="status"/);assert.match(markup,/aria-live="polite"/);assert.match(markup,/aria-atomic="true"/);
 assert.match(text,/Tiempo avanzado: 0 de 24 horas solicitadas/);assert.match(text,/Día 1 · 00:00/);
 assert.match(text,/Al pulsar Avanzar de nuevo, comienza un nuevo período desde la hora actual/);
 assert.ok(text.includes(assignmentAttentionText(state,notice.events[0],rosterFor(state))));
 assert.doesNotMatch(markup,/<button|role="dialog"|reported|binding/);
 assert.equal(draw(state),markup,'the notice remains visible during ordinary rerenders');
});

test('the notice lists every affected person with the shared assignment, sector and reason text',()=>{
 let state=initialCampaign();
 for(const operativeId of [3,4]){state.operativeState[operativeId].energy=88;state=order(state,{type:'assignCare',operativeId,assignment:'rest'});}
 state=order(state,{type:'wait',hours:6});
 const notice=publicAssignmentNotice(state);assert.equal(notice.advancedHours,1);assert.equal(notice.events.length,2);
 const markup=draw(state),text=textOnly(markup);assert.match(text,/Tiempo avanzado: 1 de 6 horas solicitadas/);
 assert.match(text,/Día 1 · 01:00/);assert.equal((markup.match(/<li>/g)??[]).length,2);
 for(const event of notice.events)assert.ok(text.includes(assignmentAttentionText(state,event,rosterFor(state))));
});

test('a doctor who uses the last kit is identified with the blocked task and sector reason',()=>{
 let state=initialCampaign();state.operativeState[3].hp-=20;state.operativeState[10].medkits=1;
 state=order(state,{type:'assignCare',operativeId:3,assignment:'patient'});
 state=order(state,{type:'assignCare',operativeId:10,assignment:'doctor'});
 state=order(state,{type:'wait',hours:6});
 const notice=publicAssignmentNotice(state),doctor=notice.events.find(event=>event.operativeId===10);
 assert.equal(notice.advancedHours,1);assert.equal(doctor.code,'no_medkits');assert.equal(doctor.state,'blocked');
 const text=textOnly(draw(state));assert.match(text,/1 de 6 horas solicitadas/);
 assert.match(text,/Paroissien · Médico en Buenos Aires · Fuerte y Retiro/);assert.match(text,/botiquines/);
 assert.ok(text.includes(assignmentAttentionText(state,doctor,rosterFor(state))));
});

test('Campaign shows the notice beside its time controls and an ordinary new advance clears an unchanged acknowledged pause',()=>{
 let state=order(initialCampaign(),{type:'assignCare',operativeId:3,assignment:'rest'});
 state=order(state,{type:'wait',hours:6});
 const markup=render(h(Campaign,{state,dispatch:noop,onBattle:noop,onOpenDesk:noop}));
 assert.equal((markup.match(/aria-label="Avance detenido por asignaciones"/g)??[]).length,1);
 assert.equal((markup.match(/>Avanzar<\/button>/g)??[]).length,1);
 assert.ok(markup.indexOf('assignment-attention')>markup.indexOf('</header>'));
 assert.ok(markup.indexOf('assignment-attention')<markup.indexOf('strategy-layout'));
 const resumed=order(state,{type:'wait',hours:1});assert.equal(resumed.hour,state.hour+1);assert.equal(draw(resumed),'');
});
