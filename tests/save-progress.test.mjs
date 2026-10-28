import { register } from 'node:module';
register('./tactical-render-loader.mjs', import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from '../apps/web/node_modules/react/index.js';
import { renderToStaticMarkup } from '../apps/web/node_modules/react-dom/server.node.js';
import { createCampaignAutosave } from '../apps/web/lib/campaign-autosave.js';
const { default: SaveProgress } = await import('../apps/web/app/SaveProgress.tsx');

function render(status, sessionId = 'campaign-one', revision = 1) {
  return renderToStaticMarkup(createElement(SaveProgress, { status, sessionId, revision }));
}

test('the save display follows persistence and does not report an older revision or another game as saved', () => {
  let status;
  const worker = { postMessage() {}, terminate() {} };
  const queue = createCampaignAutosave({
    worker,
    encode: () => 'saved game',
    write() {},
    onStatus(value) {
      status = value;
    },
  });
  queue.submit({ gameSessionId: 'campaign-one', gameRevision: 1 }, null, 'slot');
  assert.match(render(status), /Guardando…/);
  queue.flush();
  assert.match(render(status), />Guardado</);
  assert.match(render(status, 'campaign-one', 2), /Sin guardar/);
  assert.match(render(status, 'campaign-two'), /Sin guardar/);
  queue.close();
});

test('a refused browser write stays visible after an earlier successful save', () => {
  let status;
  let refuse = false;
  const queue = createCampaignAutosave({
    encode: () => 'saved game',
    write() {
      if (refuse) throw new Error('No queda espacio.');
    },
    onStatus(value) {
      status = value;
    },
  });
  queue.submit({ gameSessionId: 'campaign-one', gameRevision: 1 }, null, 'slot');
  assert.match(render(status), />Guardado</);
  refuse = true;
  queue.submit({ gameSessionId: 'campaign-one', gameRevision: 2 }, null, 'slot');
  const display = render(status, 'campaign-one', 2);
  assert.match(display, /Error al guardar/);
  assert.match(display, /No queda espacio/);
  assert.match(display, /Exportá la partida/);
  queue.close();
});
