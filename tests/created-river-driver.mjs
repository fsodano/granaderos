import assert from 'node:assert/strict';
import {
  actBattle,
  hasFirearm,
  canSee,
  teamCanSee,
  exitPreview,
} from '../packages/game/tactical.js';
import {
  sectorDeploymentAction,
  sectorDeploymentModel,
} from '../packages/game/sector-deployment.js';
import { choosePlayerSharedSightingInvestigation } from '../packages/game/tactical-ai.js';
import { cautiousCombatOrder } from './cautious-driver.ts';
export function deployRiverInfantry(start) {
  let b = sectorDeploymentAction(start, { type: 'spreadDeployment' });
  assert.equal(b.lastError, null);
  const model = sectorDeploymentModel(b),
    commander = model.units.find((u) => u.id === '57'),
    exit = b.exits.find((e) => e.destination === 'san_nicolas');
  assert.equal(commander.edge, 'S');
  assert.equal(exit.edge, 'S');
  const unit = b.units.find((u) => u.id === '57'),
    cell = model.entryCells.S.slice().sort(
      (a, c) => Math.abs(a.x - unit.x) - Math.abs(c.x - unit.x),
    )[0];
  assert.ok(cell);
  b = sectorDeploymentAction(b, { type: 'placeDeployment', unitIds: ['57'], x: cell.x, y: cell.y });
  assert.equal(b.lastError, null);
  b = sectorDeploymentAction(b, { type: 'confirmDeployment' });
  assert.equal(b.lastError, null);
  const action = { type: 'exit', unitIds: ['57'], exitId: exit.id };
  assert.equal(exitPreview(b, action).reason, null);
  b = actBattle(b, action);
  assert.equal(b.lastError, null);
  assert.equal(b.units.find((u) => u.id === '57').departure?.destination, 'san_nicolas');
  for (const row of model.units) {
    const u = b.units.find((u) => u.id === row.id);
    if (u.departure) {
      continue;
    }
    if (
      u.activeSlot !== 'primary' &&
      hasFirearm({ ...u, activeSlot: 'primary' }) &&
      !u.weaponDropped
    ) {
      b = actBattle(b, { type: 'weapon', unitId: u.id, slot: 'primary' });
      assert.equal(b.lastError, null);
    }
  }
  return b;
}
const active = (u) => u.hp >= 15 && !u.routed && !u.unconscious && !u.departure && !u.surrendered;
export function riverInfantryOrder(b, u) {
  const ordinary = cautiousCombatOrder(b, u);
  if (
    u.knockedDown ||
    u.entangled ||
    ['fire', 'reload', 'reprime', 'useItem', 'weapon', 'free'].includes(ordinary?.type)
  ) {
    return ordinary;
  }
  const contacts = b.units.filter(
    (t) => t.side !== u.side && active(t) && teamCanSee(b, u.side, t),
  );
  if (
    u.loaded &&
    !u.jammed &&
    u.activeSlot === 'primary' &&
    contacts.length &&
    !contacts.some((t) => canSee(b, u, t))
  ) {
    const seen = contacts
      .slice()
      .sort((a, c) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(c.x - u.x, c.y - u.y))[0];
    const approach = choosePlayerSharedSightingInvestigation(b, u, seen);
    if (approach) {
      return approach;
    }
  }
  return ordinary;
}
