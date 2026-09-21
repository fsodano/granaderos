import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
const {default:Distribution}=await import('../web/app/MilitiaDistribution.tsx');
const {default:Campaign}=await import('../web/app/Campaign.tsx');
const draw=s=>render(h(Distribution,{state:s,sector:'retiro',dispatch:()=>{}}));
test('sector controls show destination, rank, quantity and the automatic distribution forecast',()=>{
 const s=initialCampaign();s.sectors.retiro.militia=[6,0,0];const text=draw(s);
 for(const label of ['Destino de las milicias','Grado de las milicias','Cantidad de milicias','Distribución prevista'])assert.ok(text.includes(label));
 assert.match(text,/Buenos Aires · Plaza Mayor: 2 defensores/);assert.match(text,/Ensenada de Barragán: 2 defensores/);assert.match(text,/>Trasladar defensores<\/button>/);assert.match(text,/Los heridos inestables y los alumnos permanecen/);
 const campaign=render(h(Campaign,{state:s,dispatch:()=>{},onBattle:()=>{},onOpenDesk:()=>{}}));assert.match(campaign,/<summary>Distribuir milicias<\/summary>/);
});
test('controls explain occupied routes and disable transfers that exceed available defenders',()=>{
 const s=initialCampaign();assert.match(draw(s),/<button[^>]*disabled=""[^>]*>Trasladar defensores<\/button>/);s.sectors.buenos_aires.owner='royalist';assert.match(draw(s),/No hay otro sector propio conectado/);assert.doesNotMatch(draw(s),/>Trasladar defensores<\/button>/);
 s.pendingBattle={sector:'retiro'};assert.match(draw(s),/Resolvé el despliegue o encuentro/);
});
