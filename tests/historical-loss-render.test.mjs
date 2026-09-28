import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {servingEngineerLoss} from './historical-loss-fixture.mjs';import {campaignRole} from '../game/campaign-roles.js';
const {default:Campaign}=await import('../web/app/Campaign.tsx');
test('the strategic view explains the assigned character and blocked project after confirmed death',async()=>{
 const {campaign:s}=await servingEngineerLoss(),html=render(h(Campaign,{state:s,dispatch(){},onBattle(){},onOpenDesk(){}}));
 assert.ok(html.includes(`${campaignRole(s,'foundryEngineer').name} ha muerto antes de organizar Taller del Retiro.`));assert.match(html,/La campaña histórica no puede continuar sin su responsable de fundición/);assert.match(html,/disabled="">Avanzar/);
});
