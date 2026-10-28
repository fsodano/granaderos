import { register } from 'node:module';
register('./tactical-render-loader.mjs', import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as element, act, useState } from '../apps/web/node_modules/react/index.js';
import { JSDOM } from '../apps/web/node_modules/jsdom/lib/api.js';
import { initialCampaign } from './legacy-campaign-fixture.mjs';
import { dispatchCampaign } from '../packages/game/campaign.js';
import { pendingArrivalDecisions } from '../packages/game/squad-travel.js';
const { default: Campaign } = await import('../apps/web/app/Campaign.tsx');

function arrivalCampaign() {
  let campaign = initialCampaign();
  campaign.sectors.buenos_aires.owner = 'royalist';
  campaign = dispatchCampaign(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  campaign = dispatchCampaign(campaign, { type: 'wait', hours: 24 });
  assert.equal(campaign.lastError, null);
  assert.equal(pendingArrivalDecisions(campaign).length, 1);
  return campaign;
}

test('arrival buttons withdraw and redirect immediately through the real campaign screen', async (context) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://granaderos.test',
    pretendToBeVisual: true,
  });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const { createRoot } = await import('../apps/web/node_modules/react-dom/client.js');
  const root = createRoot(dom.window.document.getElementById('root'));
  let current;
  const actions = [];
  function Screen() {
    const [campaign, setCampaign] = useState(arrivalCampaign);
    current = campaign;
    return element(Campaign, {
      state: campaign,
      dispatch: (action) => {
        actions.push(action);
        setCampaign((value) => dispatchCampaign(value, action));
      },
      onBattle() {},
      onOpenDesk() {},
    });
  }
  context.after(async () => {
    try {
      await act(async () => root.unmount());
    } finally {
      dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    }
  });
  const document = dom.window.document;
  const click = async (target) => {
    assert.ok(target);
    await act(async () =>
      target.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })),
    );
  };
  await act(async () => root.render(element(Screen)));
  const decisionId = pendingArrivalDecisions(current)[0].id;
  const notice = document.querySelector('[aria-label^="Decisión al llegar"]');
  assert.match(notice.textContent, /Combatir.*Retirarse/);
  assert.equal(document.querySelector('.strategy-time button').disabled, true);
  await click(
    [...notice.querySelectorAll('button')].find((button) => button.textContent === 'Retirarse'),
  );
  assert.equal(actions.at(-1).type, 'withdrawOnArrival');
  assert.equal(current.lastError, null);
  assert.equal(document.querySelector('[aria-label^="Decisión al llegar"]'), null);
  assert.equal(document.querySelector('.strategy-time button').disabled, false);
  assert.doesNotMatch(
    document.querySelector('.strategy-time').textContent,
    /Elegí combatir o retirarte/,
  );
  assert.equal(current.travelNotice, null);
  await click(document.querySelector('.strategy-layout button[aria-label="Destino: Cabral"]'));
  assert.match(document.querySelector('[aria-label="Trazar ruta"]').textContent, /Cambiar destino/);
  assert.equal(document.querySelector('[aria-label="Transporte de la ruta"]').disabled, true);
  await click(document.querySelector('[data-map-sector="buenos_aires"]'));
  const confirm = [...document.querySelectorAll('[aria-label="Trazar ruta"] button')].find(
    (button) => button.textContent === 'Confirmar ruta',
  );
  assert.equal(confirm.disabled, false);
  await click(confirm);
  assert.equal(actions.at(-1).type, 'redirectJourney');
  assert.equal(current.lastError, null);
  assert.equal(current.hour, 2);
  assert.equal(current.secondOfHour ?? 0, 0);
  assert.notEqual(pendingArrivalDecisions(current)[0].id, decisionId);
  assert.ok(document.querySelector('[aria-label^="Decisión al llegar"]'));
  assert.equal(document.querySelector('.strategy-time button').disabled, true);
});
