import type { PocketRenderFixture } from './pocket-render-fixture.ts';
import type { TacticalPoint } from '../packages/game/public/compatibility-types.ts';
import type { SavedGame } from '../packages/game/save.ts';
import type { PlayerKnownState } from '../packages/game/public/player-known-types.ts';
export interface SavedFieldFixture extends PocketRenderFixture {
  saved(): SavedGame;
  read(): PlayerKnownState;
  click(text: string): Promise<void>;
}
import { present } from './assert-present.ts';
import assert from 'node:assert/strict';
import { act } from 'react';
import { tacticalGridLabel } from '../packages/game/tactical-grid.js';
import { playerKnownBattle, playerKnownCampaign } from '../packages/game/player-known-state.ts';

export function savedField(m: SavedFieldFixture) {
  const state = m.saved(),
    view = m.read();
  assert.deepEqual(view.battle, playerKnownBattle(state.battle));
  assert.deepEqual(view.campaign, playerKnownCampaign(state.campaign));
  return state;
}
export function installDialog(m: PocketRenderFixture) {
  const proto = m.dom.window.HTMLDialogElement.prototype;
  if (!proto.showModal) {
    proto.showModal = function () {
      this.setAttribute('open', '');
    };
    proto.close = function () {
      this.removeAttribute('open');
    };
  }
}
export async function openFieldEquipment(
  m: PocketRenderFixture,
  point: TacticalPoint & { id?: string },
) {
  installDialog(m);
  const marker =
    m.document.querySelector(
      `[data-ground-equipment][aria-label^="Equipo en ${tacticalGridLabel(point.x, point.y)} ·"]`,
    ) ??
    (point.id
      ? m.document.querySelector(`[data-unit-id="${point.id}"] [data-person-hit-target]`)
      : null);
  assert.ok(marker, 'visible equipment or body marker');
  await act(async () => {
    marker.dispatchEvent(new m.dom.window.MouseEvent('click', { bubbles: true }));
  });
  const dialog = m.document.querySelector('.ja2-loot-dialog');
  assert.ok(dialog, 'equipment picker opens');
  return dialog;
}
export async function selectFieldItem(m: SavedFieldFixture, name: string, count = 1) {
  await m.click('Limpiar selección');
  const checkbox = [...m.document.querySelectorAll('.ja2-loot-choice input')].find((e) =>
    e.getAttribute('aria-label')?.endsWith(` · ${name}`),
  );
  assert.ok(
    checkbox,
    `visible item ${name}: ${[...m.document.querySelectorAll('.ja2-loot-choice input')].map((e) => e.getAttribute('aria-label')).join('; ')}`,
  );
  await act(async () => {
    checkbox.dispatchEvent(new m.dom.window.MouseEvent('click', { bubbles: true }));
  });
  const input = present(
    present(checkbox.closest('.ja2-loot-row')).querySelector<HTMLInputElement>(
      'input[type="number"]',
    ),
  );
  const descriptor = present(Object.getOwnPropertyDescriptor(m.dom.window.HTMLInputElement.prototype, 'value'));
  if (typeof descriptor.set !== 'function') { throw new Error('The native form control must have a value setter.'); }
  descriptor.set.call(input, String(count));
  await act(async () => {
    input.dispatchEvent(new m.dom.window.Event('input', { bubbles: true }));
  });
  return input;
}
export async function collectFieldItem(
  m: SavedFieldFixture,
  point: TacticalPoint & { id?: string },
  name: string,
  count = 1,
) {
  await openFieldEquipment(m, point);
  await selectFieldItem(m, name, count);
  const take = m.document.querySelector<HTMLButtonElement>('.ja2-loot-dialog .gold-button');
  assert.ok(take);
  assert.equal(take.disabled, false, present(take.closest('dialog')).textContent ?? undefined);
  await m.click('Recoger selección');
  return savedField(m);
}
