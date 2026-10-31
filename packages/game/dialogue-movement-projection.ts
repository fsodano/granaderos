import { characterForOperative } from './content-character-ids.ts';
import type { CampaignSnapshot } from './public/campaign-types.ts';
import type { BattleNpc, BattleSnapshot } from './public/compatibility-types.ts';

type MovementScene = { npcs?: BattleNpc[]; sectorId?: string; sector?: string; sceneId?: string };

export function orderFor(
  state: CampaignSnapshot,
  scene: MovementScene,
  npc: BattleNpc,
): BattleNpc['scriptedMove'] {
  const characterId = characterForOperative(state, npc.operativeId)?.id;
  const sector = scene.sectorId ?? scene.sector;
  if (scene.sceneId || state.recruited.includes(Number(npc.operativeId))) {
    return undefined;
  }
  const orders = state.dialogueMovements ?? [];
  for (let index = orders.length - 1; index >= 0; index--) {
    const order = orders[index];
    if (!order) {
      throw Error('La orden de movimiento del diálogo es inválida.');
    }
    if (
      order.character === characterId &&
      order.sector === sector &&
      order.revision === npc.presenceRevision
    ) {
      return order.target === null ? undefined : { order: index, target: { ...order.target } };
    }
  }
  return undefined;
}

export function applyDialogueMovements<Scene extends MovementScene>(
  state: CampaignSnapshot,
  scene: Scene,
): Scene {
  for (const npc of scene.npcs ?? []) {
    const order = orderFor(state, scene, npc);
    if (order) {
      npc.scriptedMove = order;
    } else if (npc.scriptedMove) {
      delete npc.scriptedMove;
      if (npc.ai) {
        delete npc.ai.destination;
        npc.ai.wait = 0;
        if (!npc.ai.threat) {
          npc.ai.activity = 'roaming';
        }
      }
    }
  }
  return scene;
}

export function projectDialogueMovements(
  state: CampaignSnapshot,
  battle: BattleSnapshot,
): BattleSnapshot {
  return state.dialogueMovements?.length
    ? applyDialogueMovements(state, structuredClone(battle))
    : battle;
}
