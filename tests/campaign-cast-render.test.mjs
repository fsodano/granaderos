import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign} from '../game/campaign.js';import {defaultContentPackage} from '../game/content-package.js';import {defaultCampaignStory} from '../game/campaign-story.js';import {isHistoricalCharacter} from '../game/content-character-ids.js';
const {default:Treasury}=await import('../web/app/Treasury.tsx');
test('the treasury omits historical foundry roles absent from an authored cast and retains its usable armory',()=>{
 const d=defaultContentPackage();d.campaignStory=defaultCampaignStory();d.characters=d.characters.filter(c=>!isHistoricalCharacter(c));d.placements=[];let html=render(h(Treasury,{state:initialCampaign(42,d),dispatch(){}}));assert.doesNotMatch(html,/Organizá El Plumerillo con Beltrán|Preparar el Ejército de los Andes/);assert.match(html,/Comprar armas y revisar equipo|Armas de chispa/);
 html=render(h(Treasury,{state:initialCampaign(),dispatch(){}}));assert.match(html,/Organizá El Plumerillo con Beltrán/);
});
