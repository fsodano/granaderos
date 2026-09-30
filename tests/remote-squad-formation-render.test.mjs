import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
const {default:Squads}=await import('../web/app/Squads.tsx');
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null);return n;};
const draw=s=>render(h(Squads,{state:s,dispatch:()=>{}}));

test('formation lists towns with available troops and includes an unassigned reserve outside the selected squad town',()=>{
 let s=order(initialCampaign(),{type:'squad',ids:[3,4]});s=order(s,{type:'travel',sector:'buenos_aires'});
 let html=draw(s),form=html.match(/<form[\s\S]*?<\/form>/)[0];
 assert.match(form,/for="squad-formation-sector">Localidad de formación/);
 assert.match(form,/<option value="retiro">/);assert.match(form,/<option value="buenos_aires" selected="">/);assert.doesNotMatch(form,/<option value="cordoba"/);
 s=order(s,{type:'travel',sector:'ensenada',queue:true});html=draw(s);form=html.match(/<form[\s\S]*?<\/form>/)[0];
 assert.match(form,/<option value="retiro" selected="">/);assert.doesNotMatch(form,/<option value="buenos_aires"/);
 assert.match(form,/Paroissien/);assert.doesNotMatch(form,/Cabral/);
});
test('an army entirely in transit has no formation candidates and explains how to make them available',()=>{
 const s=order(initialCampaign(),{type:'travel',sector:'buenos_aires',queue:true}),form=draw(s).match(/<form[\s\S]*?<\/form>/)[0];
 assert.match(form,/id="squad-formation-sector" disabled=""/);assert.match(form,/role="status"/);assert.match(form,/Esperá la llegada o cancelá su ruta/);
 assert.doesNotMatch(form,/type="checkbox"/);assert.match(form,/<button[^>]*disabled=""[^>]*>Formar escuadra · 0\/6/);
});
