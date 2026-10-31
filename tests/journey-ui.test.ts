import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import { present } from './assert-present.ts';
import { register } from 'node:module';
register('../tools/test-render-loader.ts', import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as element, act, useState, useEffect } from 'react';
import { JSDOM } from 'jsdom';
import { initialCampaign } from './legacy-campaign-fixture.ts';
import { dispatchCampaign } from '../packages/game/campaign.js';
import { pendingArrivalDecisions } from '../packages/game/squad-travel.js';
const { default: Campaign } = await import('../apps/web/app/Campaign.tsx');

function arrivalCampaign() {
  let campaign = initialCampaign();
  present(campaign.sectors['buenos_aires']).owner = 'royalist';
  campaign = dispatchCampaign(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  campaign = dispatchCampaign(campaign, { type: 'wait', hours: 24 });
  assert.equal(campaign.lastError, null);
  assert.equal(pendingArrivalDecisions(campaign).length, 1);
  return campaign;
}

void test('arrival buttons withdraw and redirect immediately through the real campaign screen', async (context) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://granaderos.test',
    pretendToBeVisual: true,
  });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = new Map(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(present(dom.window.document.getElementById('root')));
  let current: CampaignSnapshot = arrivalCampaign();
  const actions: CampaignAction[] = [];
  function Screen() {
    const [campaign, setCampaign] = useState(current);
    useEffect(() => {
      current = campaign;
    }, [campaign]);
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
        if (descriptor) {
          Object.defineProperty(globalThis, key, descriptor);
        } else {
          Reflect.deleteProperty(globalThis, key);
        }
      }
    }
  });
  const document = dom.window.document;
  const click = async (target: Element | null | undefined) => {
    assert.ok(target);
    await act(async () =>
      target.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })),
    );
  };
  await act(async () => root.render(element(Screen)));
  const decisionId = present(pendingArrivalDecisions(current)[0]).id;
  const notice = document.querySelector('[aria-label^="Decisión al llegar"]');
  assert.match(present(notice).textContent, /Combatir.*Retirarse/);
  assert.equal(
    present(document.querySelector<HTMLButtonElement>('.strategy-time button')).disabled,
    true,
  );
  await click(
    [...present(notice).querySelectorAll('button')].find(
      (button) => button.textContent === 'Retirarse',
    ),
  );
  assert.equal(present(actions.at(-1)).type, 'withdrawOnArrival');
  assert.equal(present(current).lastError, null);
  assert.equal(document.querySelector('[aria-label^="Decisión al llegar"]'), null);
  assert.equal(
    present(document.querySelector<HTMLButtonElement>('.strategy-time button')).disabled,
    false,
  );
  assert.doesNotMatch(
    present(document.querySelector('.strategy-time')).textContent,
    /Elegí combatir o retirarte/,
  );
  assert.equal(present(current).travelNotice, null);
  await click(document.querySelector('.strategy-layout button[aria-label="Destino: Cabral"]'));
  assert.match(
    present(document.querySelector('[aria-label="Trazar ruta"]')).textContent,
    /Cambiar destino/,
  );
  assert.equal(
    present(document.querySelector<HTMLSelectElement>('[aria-label="Transporte de la ruta"]'))
      .disabled,
    true,
  );
  await click(document.querySelector('[data-map-sector="buenos_aires"]'));
  const confirm = [
    ...document.querySelectorAll<HTMLButtonElement>('[aria-label="Trazar ruta"] button'),
  ].find((button) => button.textContent === 'Confirmar ruta');
  assert.equal(present(confirm).disabled, false);
  await click(confirm);
  assert.equal(present(actions.at(-1)).type, 'redirectJourney');
  assert.equal(present(current).lastError, null);
  assert.equal(present(current).hour, 2);
  assert.equal(present(current).secondOfHour ?? 0, 0);
  assert.notEqual(present(pendingArrivalDecisions(current)[0]).id, decisionId);
  assert.ok(document.querySelector('[aria-label^="Decisión al llegar"]'));
  assert.equal(
    present(document.querySelector<HTMLButtonElement>('.strategy-time button')).disabled,
    true,
  );
});
