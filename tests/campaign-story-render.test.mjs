import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';import {defaultContentPackage} from '../game/content-package.js';import {defaultCampaignStory} from '../game/campaign-story.js';
const {default:Desk}=await import('../web/app/Desk.tsx'),{default:Office}=await import('../web/app/CampaignOffice.tsx'),{default:Campaign}=await import('../web/app/Campaign.tsx');
test('desk, journal and map display authored objectives and final text without original chapter or mentor instructions',()=>{
 const d=defaultContentPackage();d.campaignStory={...defaultCampaignStory(),introduction:'Protegé la correspondencia.',victory:'El correo está a salvo.',defeat:'Se perdió el correo.'};d.campaignStory.chapters[0].name='El correo';let s=initialCampaign(8,d);
 let html=render(h(Desk,{state:s,dispatch(){},onClose(){}}));assert.match(html,/Protegé la correspondencia/);assert.match(html,/El correo/);assert.doesNotMatch(html,/Marchar a San Lorenzo|Formación en Retiro|Conferencia de Yatasto/);
 html=render(h(Office,{state:s,dispatch(){},section:'journal'}));assert.match(html,/OBJETIVOS DE CAMPAÑA/);assert.match(html,/El correo/);assert.doesNotMatch(html,/Despacho dramatizado|EL CAMINO A LA INDEPENDENCIA|Formación en Retiro/);
 html=render(h(Campaign,{state:s,dispatch(){},onBattle(){},onOpenDesk(){}}));assert.match(html,/Objetivo actual de campaña/);assert.match(html,/Llegá al segundo día/);
 s=dispatchCampaign(s,{type:'wait',hours:24});assert.equal(s.completed,true);html=render(h(Campaign,{state:s,dispatch(){},onBattle(){},onOpenDesk(){}}));assert.match(html,/El correo está a salvo/);assert.doesNotMatch(html,/Las provincias están libres/);
 html=render(h(Office,{state:s,dispatch(){},section:'journal'}));assert.match(html,/El correo ✓/);assert.doesNotMatch(html,/chapter active/);
 const defeated=initialCampaign(8,d);defeated.sectors.retiro.owner='royalist';s=dispatchCampaign(defeated,{type:'wait',hours:1});html=render(h(Campaign,{state:s,dispatch(){},onBattle(){},onOpenDesk(){}}));assert.match(html,/Se perdió el correo/);
});
