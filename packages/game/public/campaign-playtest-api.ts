import type { CampaignContent, JsonObject } from '../../campaign-format/types.ts';
import type { CampaignAction, CampaignOperative } from './campaign-types.ts';
import type { BattleSnapshot, TacticalAction } from './compatibility-types.ts';
import type {
  CampaignSandbox,
  CampaignSandboxAction,
  CampaignSandboxDialogue,
  CampaignSandboxSetup,
  CampaignSandboxHistoryEntry,
} from './campaign-sandbox-types.ts';
export type {
  CampaignSandbox,
  CampaignSandboxAction,
  CampaignSandboxDialogue,
} from './campaign-sandbox-types.ts';
import { domainRefusalMessage } from '../infrastructure/shared/domain-refusal-message.js';
import { createNewGameSession, restoreGameSnapshot } from './game-persistence-api.ts';
import { TalkToCharacterUseCase } from '../application/talk-to-character/talk-to-character.use-case.ts';
import { CampaignTalkToCharacterRepository } from '../infrastructure/session/talk-to-character-repository.ts';
import { dispatchCampaign, rosterFor } from '../campaign.js';
import { prepareCampaignBattle } from '../battle-handoff.js';
import { actBattle, endTurn, getReachable, canSee } from '../tactical.js';
import { syncBattleTime } from '../time.js';
import { encodeSave } from '../save.ts';
import { dialogueForNPC } from '../content-dialogue.js';
import { dialogueConditionsMet } from '../dialogue-conditions.js';
import { characterForOperative } from '../content-character-ids.ts';
import { parseJsonObject, isJsonObject } from '../../campaign-format/json-value.ts';
import { DEFAULT_CAMPAIGN_RULES } from '../campaign-rules.js';
import { parseContentPackage } from '../content-package.js';
import { contentIdentity } from '../content-identity.js';
import { wallMovementBlocked, wallEdgeCells } from '../wall-geometry.js';

function need(ok: unknown, message: string | null | undefined): asserts ok {
  if (!ok) {
    throw new Error(message ?? 'La prueba no es válida.');
  }
}
const message = domainRefusalMessage;
// A declared test setup creates a fresh package. It never forges live quest
// states, receipts, membership or wounds in an admitted campaign snapshot.
export function createCampaignSandbox(
  content: CampaignContent,
  seed = 18130203,
  setup: CampaignSandboxSetup = {},
): CampaignSandbox {
  const definitions = structuredClone(content);
  delete definitions.campaignOrigin;
  need(
    Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff,
    'La semilla de prueba no es válida.',
  );
  if (setup.startingTreasury !== undefined) {
    need(
      Number.isSafeInteger(setup.startingTreasury) &&
        setup.startingTreasury >= 0 &&
        setup.startingTreasury <= 1000000000,
      'La tesorería de prueba no es válida.',
    );
    definitions.rules = {
      ...(definitions.rules ?? DEFAULT_CAMPAIGN_RULES),
      startingTreasury: setup.startingTreasury,
    };
  }
  if (setup.startingTerritory !== undefined) {
    definitions.startingTerritory = structuredClone(setup.startingTerritory);
  }
  const campaign = createNewGameSession(seed, definitions);
  return {
    version: 1,
    seed,
    setup: structuredClone(setup),
    sourceIdentity: contentIdentity(content),
    campaign,
    battle: null,
    history: [],
    lastError: null,
  };
}
function order(pair: CampaignSandbox, action: CampaignAction): CampaignSandbox {
  const campaign = dispatchCampaign(pair.campaign, action);
  need(!campaign.lastError, campaign.lastError);
  return { ...pair, campaign };
}
function synchronize(pair: CampaignSandbox, battle: BattleSnapshot): CampaignSandbox {
  need(!battle.lastError, battle.lastError);
  const next = syncBattleTime(pair.campaign, battle);
  need(!next.error, next.error);
  return { ...pair, campaign: next.campaign, battle: next.battle };
}
function leave(pair: CampaignSandbox): CampaignSandbox {
  need(pair.battle && pair.campaign.pendingBattle, 'Primero entrá en un sector.');
  need(
    pair.campaign.pendingBattle.exploration,
    'Terminá el combate en la vista táctica antes de volver.',
  );
  const next = order(pair, {
    type: 'leaveSector',
    battleId: pair.campaign.pendingBattle.id,
    sectorState: pair.battle,
    survivors: pair.battle.units.filter((u) => u.side === 'player'),
  });
  return { ...next, battle: null };
}
function approach(pair: CampaignSandbox, unitId: string, npcId: string): CampaignSandbox {
  need(pair.battle, 'Primero entrá en un sector.');
  need(pair.battle.mode === 'exploration', 'Acercate desde la vista táctica durante el combate.');
  for (let i = 0; i < 240; i++) {
    const battle = pair.battle;
    need(battle, 'Primero entrá en un sector.');
    const actor = battle.units.find((u) => u.id === String(unitId)),
      npc = battle.npcs?.find((n) => n.id === npcId);
    need(actor && npc, 'Elegí un combatiente y un interlocutor presentes.');
    if (
      Math.abs(actor.x - npc.x) + Math.abs(actor.y - npc.y) <= 1 &&
      !wallMovementBlocked(battle, actor, npc)
    ) {
      if (canSee(battle, actor, npc)) {
        return pair;
      }
      pair = synchronize(
        pair,
        actBattle(battle, { type: 'look', unitId: actor.id, x: npc.x, y: npc.y }),
      );
      continue;
    }
    if (actor.hp >= 15 && actor.energy < 10) {
      pair = synchronize(pair, endTurn(battle));
      continue;
    }
    const reachable = getReachable(battle, actor),
      adjacent = reachable
        .filter(
          (p) =>
            Math.abs(p.x - npc.x) + Math.abs(p.y - npc.y) === 1 &&
            !wallMovementBlocked(battle, p, npc),
        )
        .sort((a, b) => a.cost - b.cost)[0];
    let action: TacticalAction;
    const firstStep = adjacent?.path[0];
    if (firstStep) {
      action = { type: 'move', unitId: actor.id, ...firstStep };
    } else {
      const doors = (battle.wallEdges ?? []).filter(
        (d) => d.type === 'door' && !d.open && !d.locked && !d.jammed && !d.destroyed,
      );
      const next = doors
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
        )[0];
      need(
        next,
        'No hay un camino libre hasta el interlocutor. Usá la vista táctica para abrir paso.',
      );
      const step = next.p.path[0];
      if (step) {
        action = { type: 'move', unitId: actor.id, ...step };
      } else {
        need(next.door.doorId, 'La puerta necesita una identidad.');
        action = { type: 'door', unitId: actor.id, doorId: next.door.doorId };
      }
    }
    pair = synchronize(pair, actBattle(battle, action));
  }
  throw Error('No se llegó al interlocutor en 240 pasos. Usá la vista táctica.');
}
/** Execute the same strategic/tactical actions used by the live game. Failed
 * actions retain the original state; a bounded approach retains completed
 * physical steps only when it succeeds as a command. */
export function dispatchCampaignSandbox(
  state: CampaignSandbox,
  action: CampaignSandboxAction,
): CampaignSandbox {
  try {
    need(
      state?.version === 1 && state.history.length < 2000,
      'La prueba alcanzó su límite. Reiniciala.',
    );
    let next: CampaignSandbox = { ...state, lastError: null };
    if (action.type === 'enter') {
      next = order(next, { type: 'visitSector', sector: action.sector ?? next.campaign.location });
      const pair = prepareCampaignBattle(next.campaign);
      need(!pair.error, pair.error);
      next = { ...next, campaign: pair.campaign, battle: pair.battle };
    } else if (action.type === 'finish') {
      if (next.campaign.pendingBattle?.exploration) {
        next = leave(next);
      } else {
        const battle = next.battle;
        need(battle && next.campaign.pendingBattle, 'No hay una batalla abierta.');
        next = order(next, {
          type: 'battleResult',
          battleId: next.campaign.pendingBattle.id,
          outcome:
            battle.status === 'retreat'
              ? 'retreat'
              : battle.sectorCleared
                ? 'victory'
                : battle.status,
          sectorState: battle,
          survivors: battle.units
            .filter((u) => u.side === 'player')
            .map((u) => ({ ...u, id: Number(u.id) })),
        });
        next = { ...next, battle: null };
      }
    } else if (action.type === 'leave') {
      next = leave(next);
    } else if (action.type === 'wait') {
      if (next.battle) {
        next = leave(next);
      }
      next = order(next, {
        type: 'wait',
        ...(action.hours === undefined ? {} : { hours: action.hours }),
      });
    } else if (action.type === 'approach') {
      next = approach(next, action.unitId, action.npcId);
    } else if (action.type === 'talk') {
      need(next.battle, 'Primero entrá en un sector.');
      const result = new TalkToCharacterUseCase<CampaignSandbox['campaign'], BattleSnapshot>(
        new CampaignTalkToCharacterRepository(next.campaign, next.battle),
      ).execute({
        characterId: action.npcId,
        speakerId: action.unitId,
        approach: action.approach ?? 'dialogue',
        ...(action.term === undefined ? {} : { serviceTerm: action.term }),
        ...(action.node === undefined ? {} : { dialogueNodeId: action.node }),
        ...(action.choice === undefined ? {} : { dialogueChoiceId: action.choice }),
        ...(action.questResolution === undefined
          ? {}
          : {
              questResolution:
                action.questResolution === 'civic' ? 'recruit' : action.questResolution,
            }),
        ...(action.questWithdrawal === undefined
          ? {}
          : { questWithdrawal: action.questWithdrawal }),
      });
      next = { ...next, campaign: result.campaign, battle: result.sectorSession };
    } else if (action.type === 'tactical') {
      need(next.battle, 'Primero entrá en un sector.');
      next = synchronize(
        next,
        action.order?.type === 'endTurn'
          ? endTurn(next.battle)
          : actBattle(next.battle, action.order),
      );
    } else {
      next = order(next, action);
      if (next.campaign.pendingBattle && !next.battle) {
        const pair = prepareCampaignBattle(next.campaign);
        need(!pair.error, pair.error);
        next = { ...next, campaign: pair.campaign, battle: pair.battle };
      }
    }
    return {
      ...next,
      history: [
        ...state.history,
        {
          action: recordedAction(action),
          hour: next.campaign.hour,
          second: next.campaign.secondOfHour ?? 0,
          treasury: next.campaign.resources.treasury,
        },
      ],
      lastError: null,
    };
  } catch (error) {
    return { ...state, lastError: message(error) };
  }
}
export function adoptCampaignSandboxBattle(
  state: CampaignSandbox,
  battle: BattleSnapshot,
): CampaignSandbox {
  try {
    return { ...synchronize(state, battle), lastError: null };
  } catch (error) {
    return { ...state, lastError: message(error) };
  }
}
export function campaignSandboxDialogues(state: CampaignSandbox): CampaignSandboxDialogue[] {
  if (!state?.battle) {
    return [];
  }
  return (state.battle.npcs ?? []).flatMap((npc) => {
    const dialogue = dialogueForNPC(state.campaign, npc, state.battle);
    if (!dialogue) {
      return [];
    }
    const graph = characterForOperative(state.campaign, npc.operativeId)?.encounter?.dialogue,
      node = graph?.nodes.find((n) => n.id === dialogue.node);
    need(node, 'El diálogo necesita un nodo válido.');
    return [
      {
        npc,
        dialogue,
        choices: node.choices.map((choice) => ({
          choice,
          conditions: (choice.conditions ?? []).map((condition) => ({
            condition,
            met: dialogueConditionsMet(state.campaign, [condition], state.battle),
          })),
          available: dialogue.choices.find((c) => c.id === choice.id) ?? null,
        })),
      },
    ];
  });
}
export function encodeCampaignSandbox(state: CampaignSandbox): string {
  need(state?.version === 1, 'La prueba no es válida.');
  return JSON.stringify(
    {
      format: 'granaderos-editor-sandbox',
      version: 1,
      seed: state.seed,
      setup: state.setup,
      sourceIdentity: state.sourceIdentity,
      history: state.history,
      save: encodeSave(state.campaign, state.battle),
    },
    null,
    2,
  );
}
export function decodeCampaignSandbox(text: string, content: CampaignContent): CampaignSandbox {
  const value = parseJsonObject(text);
  const history = readHistory(value['history']);
  need(
    value['format'] === 'granaderos-editor-sandbox' && value['version'] === 1,
    'El archivo no es una prueba del taller.',
  );
  const sourceIdentity = value['sourceIdentity'];
  need(
    isJsonObject(sourceIdentity) && sourceIdentity['hash'] === contentIdentity(content).hash,
    'La prueba pertenece a otro contenido. Reiniciala con el proyecto actual.',
  );
  const seed = value['seed'];
  need(typeof seed === 'number', 'La semilla de prueba no es válida.');
  const rawSetup = value['setup'] ?? {};
  need(isJsonObject(rawSetup), 'La configuración de prueba no es válida.');
  const setup: CampaignSandboxSetup = {};
  if (rawSetup['startingTreasury'] !== undefined) {
    const treasury = rawSetup['startingTreasury'];
    need(typeof treasury === 'number', 'La tesorería de prueba no es válida.');
    setup.startingTreasury = treasury;
  }
  if (rawSetup['startingTerritory'] !== undefined) {
    const definitions = parseContentPackage(
      JSON.stringify({ ...content, startingTerritory: rawSetup['startingTerritory'] }),
    );
    need(definitions.startingTerritory !== undefined, 'El territorio de prueba no es válido.');
    setup.startingTerritory = definitions.startingTerritory;
  }
  const save = value['save'];
  need(typeof save === 'string', 'La partida de prueba no es válida.');
  const expected = createCampaignSandbox(content, seed, setup),
    pair = restoreGameSnapshot(save);
  need(expected.campaign.contentCampaign, 'La prueba necesita contenido de campaña.');
  need(
    pair.campaign.contentCampaign?.identity.hash ===
      expected.campaign.contentCampaign.identity.hash,
    'La partida de prueba no corresponde a su configuración.',
  );
  return { ...expected, ...pair, history, lastError: null };
}
export function campaignSandboxActors(state: CampaignSandbox): CampaignOperative[] {
  return rosterFor(state.campaign);
}

function recordedAction(action: CampaignSandboxAction): JsonObject & { type: string } {
  const document = parseJsonObject(JSON.stringify(action));
  return { ...document, type: action.type };
}

function readHistory(value: unknown): CampaignSandboxHistoryEntry[] {
  need(Array.isArray(value) && value.length <= 2000, 'El archivo no es una prueba del taller.');
  return value.map((entry: unknown) => {
    const invalid = 'El historial de la prueba contiene un recibo inválido.';
    need(isJsonObject(entry), invalid);
    const action = entry['action'],
      hour = entry['hour'],
      second = entry['second'],
      treasury = entry['treasury'];
    need(
      isJsonObject(action) && typeof action['type'] === 'string' && action['type'].length > 0,
      invalid,
    );
    need(typeof hour === 'number' && Number.isSafeInteger(hour) && hour >= 0, invalid);
    need(
      typeof second === 'number' && Number.isSafeInteger(second) && second >= 0 && second < 3600,
      invalid,
    );
    need(typeof treasury === 'number' && Number.isFinite(treasury) && treasury >= 0, invalid);
    return { action: { ...action, type: action['type'] }, hour, second, treasury };
  });
}
