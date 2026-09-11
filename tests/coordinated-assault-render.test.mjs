import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {createBattle} from '../game/tactical.js';
const {default:TravelStatus}=await import('../web/app/TravelStatus.tsx');
const {default:JA2Roster}=await import('../web/app/JA2Roster.tsx');
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null);return n;};
test('the boundary panel offers an attack and states which squad still needs time',()=>{
 let s=initialCampaign();s.location='buenos_aires';s.squads[0].location=s.location;s=order(s,{type:'createSquad',name:'Reserva',ids:[3]});s=order(s,{type:'attack',sector:'san_nicolas',queue:true});s=order(s,{type:'wait',hours:4});s=order(s,{type:'selectSquad',id:'squad-1'});s=order(s,{type:'attack',sector:'san_nicolas',queue:true});s=order(s,{type:'wait',hours:24});const html=render(h(TravelStatus,{state:s,dispatch:()=>{}}));assert.match(html,/Atacar con las escuadras listas/);assert.match(html,/Primera escuadra \(4 h\)/);assert.match(html,/En el límite de/);assert.match(html,/Regresar · 12 h/);assert.doesNotMatch(html,/Detenerse en el próximo sector/);
});
test('the tactical strip exposes every soldier from a twelve-person deployment',()=>{
 const b=createBattle(Array.from({length:12},(_,i)=>({id:i,name:`Soldado ${i+1}`,weapon:1800,x:1+i,y:1})),{enemies:[]});const html=render(h(JA2Roster,{battle:b,players:b.units,selected:'11',onSelect:()=>{},onOpenInventory:()=>{}}));assert.equal((html.match(/role="listitem"/g)??[]).length,12);assert.match(html,/multiple-squads/);assert.match(html,/12\. Soldado 12/);assert.match(html,/ja2-portrait-cell active/);
});
