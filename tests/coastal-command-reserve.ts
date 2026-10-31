import {present} from './assert-present.ts';
import type { CampaignAction } from '../packages/game/public/campaign-types.ts';
import assert from 'node:assert/strict';
import { actBattle, exitPreview } from '../packages/game/tactical.js';
import {
  sectorDeploymentAction,
  sectorDeploymentModel,
} from '../packages/game/sector-deployment.js';

// A commander arriving on the west edge cannot immediately take a north exit
// from the middle of that edge. Use only the authorized intersection of the
// arrival and departure edges, then pay the normal crossing order.
export function withdrawCoastalCommandToRear(
  initial,
  unitId,
  destination,
  { onOrder = () => {} } = {},
) {
  return (start) => {
    let battle = start;
    const model = sectorDeploymentModel(start);
    assert.ok(model);
    const id = String(unitId),
      arrival = model.units.find((unit) => unit.id === id),
      exit = start.exits.find((exit) => exit.destination === destination);
    assert.ok(arrival, 'the commander must be an actual arriving combatant');
    assert.ok(exit, 'the rear destination must have an actual exit');
    const atExit = (point) =>
      exit.edge === 'N'
        ? point.y === 0
        : exit.edge === 'S'
          ? point.y === start.height - 1
          : exit.edge === 'W'
            ? point.x === 0
            : point.x === start.width - 1;
    const original = initial.units.find((unit) => unit.id === id);
    assert.ok(original);
    const point = present(model.entryCells[arrival.edge])
      .filter(atExit)
      .sort(
        (a, b) =>
          Math.abs(a.x - original.x) +
            Math.abs(a.y - original.y) -
            Math.abs(b.x - original.x) -
            Math.abs(b.y - original.y) ||
          a.y - b.y ||
          a.x - b.x,
      )[0];
    assert.ok(point, 'the actual arrival edge must have a legal cell on the rear exit edge');
    const order = (action: CampaignAction, deployment = false) => {
      const next = deployment ? sectorDeploymentAction(battle, action) : actBattle(battle, action);
      assert.equal(next.lastError, null, JSON.stringify(action) + ': ' + next.lastError);
      battle = next;
      onOrder(structuredClone(action));
    };
    for (const row of model.units) {
      const issued = initial.units.find((unit) => unit.id === row.id);
      assert.ok(issued);
      const placement = row.id === id ? point : issued;
      order({ type: 'placeDeployment', unitIds: [row.id], x: placement.x, y: placement.y }, true);
    }
    order({ type: 'confirmDeployment' }, true);
    const action = { type: 'exit', unitIds: [id], exitId: exit.id };
    assert.equal(
      exitPreview(battle, action).reason,
      null,
      'the confirmed placement must reach the real exit boundary',
    );
    order(action);
    assert.equal(present(battle.units.find((unit) => unit.id === id)).departure?.destination, destination);
    return battle;
  };
}
