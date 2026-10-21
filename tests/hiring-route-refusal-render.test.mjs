import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {activeSquad} from '../game/squads.js';
import {secureArea} from './controlled-area-fixture.mjs';
const {default:Recruitment}=await import('../web/app/Recruitment.tsx');

const refusal='Esperá la llegada o cancelá la ruta antes de reorganizar la escuadra.';
const hire={type:'recruitCivic',id:100,term:'day',destination:'retiro'};
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
function campaign(){
 const content=defaultContentPackage();
 content.characters.find(c=>c.id==='person-103').arrivalHours=0;
 content.characters.find(c=>c.id==='person-110').arrivalHours=24;
 let s=secureArea(initialCampaign(42,content),'buenos_aires','ensenada');s.resources.treasury=100000;
 s=order(s,{type:'recruitCivic',id:103,term:'week'});
 return order(s,{type:'recruitCivic',id:110,term:'week',destination:'retiro'});
}
function traveling(status='moving'){
 let s=campaign();
 if(status==='ready')s.sectors.buenos_aires.owner='royalist';
 if(status==='paused')s.operativeState[103].fatigue=78;
 s=order(s,{type:status==='ready'?'attack':'travel',sector:status==='paused'?'ensenada':'buenos_aires',queue:true});
 if(status==='ready'){
  const hours=activeSquad(s).journey.legHours;
  for(let hour=0;hour<hours;hour++)s=order(s,{type:'wait',hours:1});
 }else if(status==='paused')s=order(s,{type:'wait',hours:1});
 assert.equal(activeSquad(s).journey?.status,status);
 return s;
}
function catalogue(s,inspect){
 const dom=new JSDOM(render(h(Recruitment,{state:s,dispatch:()=>{}})));
 try{inspect(dom.window.document);}finally{dom.window.close();}
}
function card(document,id){const found=document.querySelector(`[data-operative-id="${id}"]`);assert.ok(found,`operative ${id}`);return found;}
function button(parent,prefix){const found=[...parent.querySelectorAll('button')].find(b=>b.textContent.startsWith(prefix));assert.ok(found,prefix);return found;}

for(const status of ['moving','paused','ready'])test(`a ${status} route explains the disabled new hire beside its button and preserves other contract actions`,()=>{
 const s=traveling(status),before=structuredClone(s),rejected=dispatchCampaign(s,hire);
 assert.equal(rejected.lastError,refusal);
 assert.deepEqual({...rejected,lastError:null},s,'a rejected hire changes only the error');
 assert.deepEqual(s,before,'dispatch does not mutate the source campaign');
 catalogue(s,document=>{
  const candidate=card(document,100),buy=button(candidate,'Contratar ·');
  assert.equal(buy.disabled,true);
  const reason=document.getElementById(buy.getAttribute('aria-describedby'));
  assert.ok(reason&&candidate.contains(reason),'the refusal is inside the affected card');
  assert.equal(reason.textContent,rejected.lastError);
  assert.equal(reason.nextElementSibling,buy,'the refusal is next to its button');
  const renewal=button(card(document,103),'Renovar ·');assert.equal(renewal.disabled,false);assert.equal(renewal.hasAttribute('aria-describedby'),false);
  const arrival=card(document,110);assert.equal(arrival.querySelector('select').disabled,false);assert.equal(button(arrival,'Cancelar llegada ·').disabled,false);
 });
 const renewed=order(s,{type:'renewContract',id:103,term:'day'});assert.ok(renewed.contracts[103].expiresAt>s.contracts[103].expiresAt);assert.deepEqual(renewed.squads,s.squads);
 const redirected=order(s,{type:'redirectHire',id:110,destination:'ensenada'});assert.equal(redirected.hiringArrivals[0].destination,'ensenada');assert.deepEqual(redirected.squads,s.squads);
 const canceled=order(s,{type:'cancelHireArrival',id:110});assert.equal(canceled.hiringArrivals.length,0);assert.deepEqual(canceled.squads,s.squads);
});

test('canceling the route removes the inline refusal and permits a new hire',()=>{
 const stopped=order(traveling(),{type:'cancelTravel'});
 catalogue(stopped,document=>{const candidate=card(document,100),buy=button(candidate,'Contratar ·');assert.equal(buy.disabled,false);assert.equal(buy.hasAttribute('aria-describedby'),false);assert.ok(!candidate.textContent.includes(refusal));});
 const hired=order(stopped,hire);assert.ok(hired.recruited.includes(100));assert.ok(hired.resources.treasury<stopped.resources.treasury);
});

test('selecting a stationary squad permits hiring while another squad still travels',()=>{
 let s=order(campaign(),{type:'createSquad',name:'En marcha',ids:[103]});
 s=order(s,{type:'travel',sector:'buenos_aires',queue:true});const travelingId=s.activeSquadId,journey=structuredClone(activeSquad(s).journey);
 s=order(s,{type:'selectSquad',id:'squad-1'});
 catalogue(s,document=>{const candidate=card(document,100);assert.equal(button(candidate,'Contratar ·').disabled,false);assert.ok(!candidate.textContent.includes(refusal));});
 const hired=order(s,hire);assert.ok(hired.squad.includes(100));assert.deepEqual(hired.squads.find(q=>q.id===travelingId).journey,journey);
});
