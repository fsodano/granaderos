import { initialCampaign } from '../packages/game/campaign.js';
import type { CampaignSaveWorker } from '../apps/web/lib/campaign-autosave.ts';
import type { SaveStatus } from '../packages/game/application/get-save-status/get-save-status.repository.ts';
import { present } from './assert-present.ts';
import { register } from 'node:module';
register('../tools/test-render-loader.ts', import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createCampaignAutosave } from '../apps/web/lib/campaign-autosave.ts';
const { default: SaveProgress } = await import('../apps/web/app/SaveProgress.tsx');

function render(status: SaveStatus | undefined, sessionId = 'campaign-one', revision = 1) {
  return renderToStaticMarkup(
    createElement(SaveProgress, { status: present(status), sessionId, revision }),
  );
}

void test('the save display follows persistence and does not report an older revision or another game as saved', () => {
  let status: SaveStatus | undefined;
  const worker: CampaignSaveWorker = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage() {},
    terminate() {},
  };
  const queue = createCampaignAutosave({
    worker,
    encode: () => 'saved game',
    write() {},
    onStatus(value) {
      status = value;
    },
  });
  queue.submit(
    { ...initialCampaign(), gameSessionId: 'campaign-one', gameRevision: 1 },
    null,
    'slot',
  );
  assert.match(render(status), /Guardando…/);
  queue.flush();
  assert.match(render(status), />Guardado</);
  assert.match(render(status, 'campaign-one', 2), /Sin guardar/);
  assert.match(render(status, 'campaign-two'), /Sin guardar/);
  queue.close();
});

void test('a refused browser write stays visible after an earlier successful save', () => {
  let status: SaveStatus | undefined;
  let refuse = false;
  const queue = createCampaignAutosave({
    encode: () => 'saved game',
    write() {
      if (refuse) {
        throw new Error('No queda espacio.');
      }
    },
    onStatus(value) {
      status = value;
    },
  });
  queue.submit(
    { ...initialCampaign(), gameSessionId: 'campaign-one', gameRevision: 1 },
    null,
    'slot',
  );
  assert.match(render(status), />Guardado</);
  refuse = true;
  queue.submit(
    { ...initialCampaign(), gameSessionId: 'campaign-one', gameRevision: 2 },
    null,
    'slot',
  );
  const display = render(status, 'campaign-one', 2);
  assert.match(display, /Error al guardar/);
  assert.match(display, /No queda espacio/);
  assert.match(display, /Exportá la partida/);
  queue.close();
});
