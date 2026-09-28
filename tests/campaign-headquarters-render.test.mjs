import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from '../game/campaign.js';import {defaultContentPackage} from '../game/content-package.js';import {defaultStartingTerritory} from '../game/content-territory.js';
const {default:Desk}=await import('../web/app/Desk.tsx'),{default:Office}=await import('../web/app/CampaignOffice.tsx');
test('the desk and journal name the chosen formation headquarters while retaining later historical chapters',()=>{
 const d=defaultContentPackage();d.headquarters='salta';d.startingTerritory=defaultStartingTerritory('salta');const s=initialCampaign(8,d);
 for(const view of [h(Desk,{state:s,dispatch(){},onClose(){}}),h(Office,{state:s,dispatch(){},section:'journal'})]){const html=render(view);assert.match(html,/Formación en Salta/);assert.match(html,/primer contratado en Salta/);assert.doesNotMatch(html,/Formación en Retiro|Empezás con Retiro/);}
});
