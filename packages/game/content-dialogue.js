import { validateDialogue as validateDialogueDocument } from '../campaign-format/dialogue-schema.js';
import { campaignSectors } from './campaign-definition.js';
import { validateContentQuestState } from './content-quests.js';
import {
  dialogueEffectQuote,
  applyDialogueEffects,
  validateDialogueReceipts,
  validateLastDialogueEffect,
} from './dialogue-effects.js';
import { dialogueConditionsMet } from './dialogue-conditions.js';
import { characterForOperative } from './content-character-ids.ts';
const need = (ok, message) => {
  if (!ok) {
    throw Error(message);
  }
};

const definition = (s, npc) => characterForOperative(s, npc?.operativeId)?.encounter?.dialogue;
const view = (s, npc, node, battle) => ({
  node: node.id,
  text: node.text,
  choices: node.choices
    .filter((c) => dialogueConditionsMet(s, c.conditions, battle))
    .map((c) => {
      const quote = dialogueEffectQuote(s, npc, node.id, c, battle);
      return {
        id: c.id,
        label: c.label,
        ...(quote
          ? { effectLabel: quote.label, available: quote.available, reason: quote.reason }
          : {}),
      };
    }),
});
/** @param {import('./public/campaign-types.ts').CampaignSnapshot} s
 * @param {import('./public/compatibility-types.ts').BattleNpc} npc
 * @param {import('./public/compatibility-types.ts').BattleSnapshot|null} [battle]
 * @returns {import('./public/hud-types.ts').DialogueView|null} */
export function dialogueForNPC(s, npc, battle = null) {
  const graph = definition(s, npc);
  if (!graph) {
    return null;
  }
  const node = graph.nodes.find(
    (n) => n.id === (s.conversations?.[npc.id]?.dialogueNode ?? graph.entry),
  );
  need(node, 'El pasaje guardado no pertenece al diálogo.');
  return view(s, npc, node, battle);
}
export function chooseDialogue(s, npc, choice, expectedNode, battle = null) {
  const current = dialogueForNPC(s, npc, battle);
  need(current, 'Este habitante no tiene un diálogo con opciones.');
  if (choice === undefined) {
    need(expectedNode === undefined, 'Falta la opción del diálogo.');
    return current;
  }
  need(
    expectedNode === current.node,
    'La conversación cambió. Elegí una opción del pasaje actual.',
  );
  const graph = definition(s, npc),
    node = graph.nodes.find((n) => n.id === current.node),
    selected = node.choices.find((c) => c.id === choice);
  need(selected, 'Esa opción no pertenece al pasaje actual.');
  need(
    current.choices.some((c) => c.id === choice),
    'Esa opción no está disponible en este momento.',
  );
  const effect = applyDialogueEffects(s, npc, node.id, selected, battle),
    next = graph.nodes.find((n) => n.id === selected.next);
  return { ...view(s, npc, next, battle), ...(effect ? { effect } : {}) };
}
export function validateSavedDialogues(s, npcs) {
  for (const [npcId, record] of Object.entries(s.conversations ?? {})) {
    const npc = npcs.find((n) => n.id === npcId),
      graph = definition(s, npc);
    validateDialogueReceipts(s, graph, record);
    if (record.dialogueNode !== undefined) {
      need(
        graph?.nodes.some((n) => n.id === record.dialogueNode),
        'El pasaje guardado no pertenece al diálogo.',
      );
    }
    if (record.lastApproach === 'dialogue') {
      need(
        record.dialogueNode !== undefined && graph,
        'Falta el pasaje de la conversación guardada.',
      );
    }
  }
  validateContentQuestState(s, npcs);
  const last = s.lastConversation,
    npc = npcs.find((n) => n.id === last?.npcId);
  validateLastDialogueEffect(s, npc, definition(s, npc), last);
  if (last?.outcome !== 'dialogue') {
    return;
  }
  const current = dialogueForNPC(s, npc);
  need(
    current &&
      last.dialogueNode === current.node &&
      last.text === current.text &&
      s.conversations[last.npcId]?.lastApproach === 'dialogue',
    'El texto guardado no coincide con el diálogo del habitante.',
  );
}

export function validateDialogue(graph, characters, quests, context = null) {
  return validateDialogueDocument(
    graph,
    characters,
    quests,
    new Set(campaignSectors(context).map((sector) => sector.id)),
  );
}
