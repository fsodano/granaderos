import type { BattleOrder } from './opening-driver.ts';
import { present } from './assert-present.ts';
import type { BattleSnapshot, MoveAction } from '../packages/game/public/compatibility-types.ts';
import { actBattle, getReachable, endTurn, canSee } from '../packages/game/tactical.js';
import { wallEdgeCells, wallMovementBlocked } from '../packages/game/wall-geometry.js';
import { sameSurface, spaceKey } from '../packages/game/tactical-space.js';
import { dialogueApproach } from '../packages/game/npc-dialogue.ts';
import {
  beginNPCApproachEvidence,
  observeNPCApproachAction,
  recordNPCApproachFailure,
} from './npc-approach-evidence.ts';
// Civilian routines advance during movement. Replan short, legal steps rather
// than walking toward an obsolete NPC coordinate on a larger sector.
export function approachNPC(battle: BattleSnapshot, unitId: string | number, npcId: string) {
  const trace = beginNPCApproachEvidence(battle, unitId, npcId);
  const visits = new Map<string, number>();
  let chasing = false,
    lastNpcPosition = null,
    npcMoves = 0;
  const run = (action: BattleOrder) => {
    const before = battle;
    battle = action.type === 'endTurn' ? endTurn(battle) : actBattle(battle, action);
    observeNPCApproachAction(trace, before, battle, action);
  };
  try {
    for (let i = 0; i < 240; i++) {
      const actor = battle.units.find((u) => u.id === String(unitId)),
        npc = battle.npcs.find((n) => n.id === npcId);
      if (!actor || !npc) {
        throw Error('Missing interlocutor or actor.');
      }
      if (
        sameSurface(actor, npc) &&
        Math.abs(actor.x - npc.x) + Math.abs(actor.y - npc.y) <= 1 &&
        !wallMovementBlocked(battle, actor, npc)
      ) {
        if (canSee(battle, actor, npc)) {
          return battle;
        }
        run({ type: 'look', unitId: actor.id, x: npc.x, y: npc.y });
        if (battle.lastError) {
          throw Error(battle.lastError);
        }
        continue;
      }
      if (actor.hp >= 15 && actor.energy < 10 && battle.mode === 'exploration') {
        run({ type: 'endTurn' });
        if (battle.lastError) {
          throw Error(battle.lastError);
        }
        continue;
      }
      const reachable = getReachable(battle, actor);
      const adjacent = dialogueApproach(
        reachable.filter((p) => !wallMovementBlocked(battle, p, npc)),
        npc,
      );
      const npcPosition = spaceKey(npc),
        pair = `${spaceKey(actor)}>${npcPosition}`;
      if (lastNpcPosition !== null && lastNpcPosition !== npcPosition) {
        npcMoves++;
      }
      lastNpcPosition = npcPosition;
      // Keep successful walking meetings exact. A repeated physical pair after
      // actual civilian movement proves a chase cycle. Only then use ordinary
      // running, within the same 240 actions and with its native energy/time costs.
      if (visits.has(pair) && npcMoves > present(visits.get(pair))) {
        chasing = true;
      }
      if (!visits.has(pair)) {
        visits.set(pair, npcMoves);
      }
      const movement: Pick<MoveAction, 'movement'> =
        chasing && battle.mode === 'exploration' && npc.ai?.activity === 'roaming'
          ? { movement: 'run' }
          : {};
      let action: BattleOrder;
      if (adjacent?.path.length) {
        action = { type: 'move', unitId: actor.id, ...present(adjacent.path[0]), ...movement };
      } else {
        const doors = present(battle.wallEdges).filter(
          (t) => t.type === 'door' && !t.open && !t.locked && !t.jammed && !t.destroyed,
        );
        const options = doors
          .flatMap((door) =>
            reachable
              .filter((p) =>
                wallEdgeCells(door).some(
                  (c) =>
                    c.x === p.x && c.y === p.y && (c.tacticalLevel ?? 0) === (p.tacticalLevel ?? 0),
                ),
              )
              .map((p) => ({ door, p })),
          )
          .sort(
            (a, b) =>
              a.p.cost +
              Math.abs(a.door.x - npc.x) +
              Math.abs(a.door.y - npc.y) -
              (b.p.cost + Math.abs(b.door.x - npc.x) + Math.abs(b.door.y - npc.y)),
          );
        const next = options[0];
        if (!next) {
          throw Error(
            `No legal approach to ${npcId}: ${JSON.stringify({ actor: { x: actor.x, y: actor.y, hp: actor.hp, energy: actor.energy, ap: actor.ap, unconscious: actor.unconscious }, npc: { x: npc.x, y: npc.y }, reachable: reachable.length })}`,
          );
        }
        action = next.p.path.length
          ? { type: 'move', unitId: actor.id, ...present(next.p.path[0]), ...movement }
          : { type: 'door', unitId: actor.id, doorId: present(next.door.doorId) };
      }
      run(action);
      if (battle.lastError) {
        throw Error(battle.lastError);
      }
    }
    throw Error(`Interlocutor ${npcId} was not reached within 240 legal steps.`);
  } catch (error) {
    recordNPCApproachFailure(trace, battle, error);
    throw error;
  }
}
