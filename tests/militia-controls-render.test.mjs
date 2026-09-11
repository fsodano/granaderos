import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
const {default:Campaign}=await import('../web/app/Campaign.tsx');
const draw=militia=>{const s=initialCampaign();s.sectors.retiro.militia=militia;return render(h(Campaign,{state:s,dispatch:()=>{},onBattle:()=>{},onOpenDesk:()=>{}}));};
test('full regular garrisons cannot buy a veteran course and the map explains combat promotion',()=>{
 const markup=draw([0,60,0]);assert.match(markup,/Cívicos: 0 · Montoneras: 60 · Veteranos: 0/);assert.match(markup,/Los veteranos ascienden en combate/);assert.match(markup,/<button[^>]*disabled=""[^>]*>Entrenar milicias/);assert.match(markup,/No hay espacio para otra cohorte/);
});
test('available civic promotions remain enabled at capacity and cost the regular-course price',()=>{
 const markup=draw([3,56,1]);assert.match(markup,/Cívicos: 3 · Montoneras: 56 · Veteranos: 1/);const button=markup.match(/<button[^>]*>Entrenar milicias[^<]*(?:<!--[\s\S]*?-->)?[^<]*<\/button>/)?.[0];assert.ok(button);assert.ok(!button.includes('disabled'));assert.match(button,/120 pesos/);assert.match(markup,/Promover tres defensores/);
});
