import type { CampaignSnapshot, CampaignAction } from '../packages/game/public/campaign-types.ts';
import type { BattleSnapshot } from '../packages/game/public/compatibility-types.ts';
import type { TacticalOrder } from '../packages/game/public/hud-types.ts';
import type { SavedGame } from '../packages/game/save.ts';
import type { CharacterDefinition } from '../packages/campaign-format/types.ts';
export interface ActiveGame {
  campaign: CampaignSnapshot;
  battle: BattleSnapshot;
}
type LocalPackageOptions = {
  pay?: number;
  service?: CharacterDefinition['service'];
  recruitable?: boolean;
};
import { present } from './assert-present.ts';
import assert from 'node:assert/strict';
import { realpathSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultContentPackage } from '../packages/game/content-package.js';
import { initialCampaign, dispatchCampaign } from '../packages/game/campaign.js';
import { operativeIdForCharacter } from '../packages/game/content-character-ids.ts';
import { actBattle, createBattle } from '../packages/game/tactical.js';
import { enterSector } from '../packages/game/world.js';
import { syncBattleTime } from '../packages/game/time.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';
import { approachNPC } from './approach-npc.ts';
export const A = 'cell-27-27';
export const order = (s: CampaignSnapshot, a: CampaignAction) => {
  const n = dispatchCampaign(s, a);
  assert.equal(n.lastError, null, n.lastError ?? undefined);
  return n;
};
let currentQAExportSequence = 0;
export function saved(p: ActiveGame): ActiveGame;
export function saved(p: { campaign: CampaignSnapshot; battle?: BattleSnapshot | null }): SavedGame;
export function saved(p: {
  campaign: CampaignSnapshot;
  battle?: BattleSnapshot | null;
}): SavedGame {
  const encoded = encodeSave(p.campaign, p.battle ?? null),
    restored = decodeSave(encoded);
  const requested = process.env['GRANADEROS_CURRENT_QA_EXPORT_DIR'];
  if (requested && (restored.campaign.completed === true || restored.campaign.defeated === true)) {
    assert.ok(isAbsolute(requested), 'Current QA exports require an absolute external directory.');
    const directory = realpathSync(requested),
      source = realpathSync(fileURLToPath(new URL('../', import.meta.url))),
      location = relative(source, directory);
    assert.ok(
      location === '..' || location.startsWith('..' + sep),
      'Current QA exports must stay outside the source checkout.',
    );
    const c = restored.campaign,
      outcome = c.completed ? 'victory' : 'defeat',
      testFile = basename(process.argv[1] ?? 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_');
    // These are current-run outputs only. Use them for browser QA only after
    // the entire unchanged original whole test file passes.
    writeFileSync(
      join(
        directory,
        `current-qa-${testFile}-${process.pid}-${++currentQAExportSequence}-${outcome}-${c.hour}-${c.secondOfHour ?? 0}.save.json`,
      ),
      encoded,
      { flag: 'wx' },
    );
  }
  if (p.battle) {
    assert.ok(restored.battle);
  }
  return restored;
}
export const localId = (s: CampaignSnapshot) =>
  operativeIdForCharacter(present(s.contentCampaign).package, 'alma-contract');
export const localNPC = (b: BattleSnapshot) =>
  present(b.npcs.find((n) => n.contentId === 'alma-contract'));
export function localPackage({
  pay = 300,
  service = 'contract',
  recruitable = true,
}: LocalPackageOptions = {}) {
  const d = defaultContentPackage(),
    base = structuredClone(present(d.characters.find((c) => c.id === 'person-100')));
  delete present(base).arrivalHours;
  present(d.rules).startingHour = 0;
  d.characters.push({
    ...base,
    id: 'alma-contract',
    name: 'Alma Contratada',
    nickname: 'Alma',
    service,
    monthlyPay: pay,
    recruitmentSource: 'encounter',
    weapon: null,
    attributes: { ...present(base).attributes, maxHp: 95 },
    encounter: {
      recruitable,
      greeting: 'Trabajo por un plazo acordado.',
      requiredLeadership: 0,
      requiredLiberated: 0,
      requiredSector: null,
    },
  });
  d.placements.push({
    id: 'alma-location',
    character: 'alma-contract',
    mode: 'fixed',
    sectors: [A],
    moveChance: 100,
    afterDeath: null,
    delayMin: 0,
    delayMax: 0,
  });
  present(d.characters.find((c) => c.id === 'person-110')).arrivalHours = 0;
  return d;
}
export const visit = (s: CampaignSnapshot) => {
  const campaign = order(s, { type: 'visitSector' });
  return saved({
    campaign,
    battle: enterSector(
      { ...campaign.pendingBattle, hour: campaign.hour, secondOfHour: campaign.secondOfHour ?? 0 },
      campaign.sectorStates[campaign.location],
    ),
  });
};
export const sync = (p: ActiveGame): ActiveGame => {
  const n = syncBattleTime(p.campaign, p.battle);
  assert.equal(n.error, null, n.error ?? undefined);
  return { campaign: n.campaign, battle: n.battle };
};
export function tactical(p: ActiveGame, action: TacticalOrder) {
  const battle = actBattle(p.battle, {
    unitId: present(p.battle.units.find((u) => u.side === 'player')).id,
    ...action,
  });
  assert.equal(battle.lastError, null, battle.lastError ?? undefined);
  return sync({ campaign: p.campaign, battle });
}
export function readyLocal(options: LocalPackageOptions = {}, content = localPackage(options)) {
  let s = order(initialCampaign(42, content), { type: 'recruitCivic', id: 110, term: 'month' });
  // Schedule daily residents after their first real relocation, so the rural
  // approach finishes before the next daily decision.
  if (present(content.placements.find((p) => p.character === 'alma-contract')).mode === 'daily') {
    s = order(s, {
      type: 'wait',
      hours: Math.ceil(
        (present(s.contentPresence).nextDaily - present(s.contentPresence).minute) / 60,
      ),
    });
  }
  s = order(s, {
    type: 'travel',
    sector: present(present(present(s.contentPresence).people['alma-contract']).sector),
  });
  const p = visit(s),
    n = localNPC(p.battle),
    unit = present(p.battle).units.find((u) => u.side === 'player');
  return sync({ campaign: p.campaign, battle: approachNPC(p.battle, present(unit).id, n.id) });
}
export const talk = (
  p: ActiveGame,
  term = 'day',
  approach = 'recruit',
): Extract<CampaignAction, { type: 'talkNPC' }> => ({
  type: 'talkNPC',
  npcId: localNPC(p.battle).id,
  unitId: present(p.battle.units.find((u) => u.side === 'player')).id,
  term,
  approach,
  sectorState: p.battle,
});
export function approachLocal(p: ActiveGame) {
  const actor = p.battle.units.find((u) => u.side === 'player'),
    npc = localNPC(p.battle),
    movement = present(actor).movementMode ?? 'walk';
  if (movement !== 'run') {
    p = tactical(p, { type: 'movement', unitId: present(actor).id, movement: 'run' });
  }
  p = sync({ campaign: p.campaign, battle: approachNPC(p.battle, present(actor).id, npc.id) });
  if (movement !== 'run') {
    p = tactical(p, { type: 'movement', unitId: present(actor).id, movement });
  }
  return p;
}
export function hireLocal(p: ActiveGame, term = 'day') {
  p = approachLocal(p);
  const npc = localNPC(p.battle),
    campaign = order(p.campaign, talk(p, term)),
    id = localId(campaign),
    op = present(campaign.pendingBattle).squad.find((u) => u.id === id),
    battle = structuredClone(p.battle);
  battle.npcs = battle.npcs.filter((n) => n.id !== npc.id);
  battle.units.push({
    ...present(
      createBattle([op], { width: 8, height: 8, exploration: true, enemies: [] }).units[0],
    ),
    x: npc.x,
    y: npc.y,
  });
  return saved({ campaign, battle });
}
export const leave = (p: ActiveGame) => {
  p = sync(p);
  return order(p.campaign, {
    type: 'leaveSector',
    battleId: present(p.campaign.pendingBattle).id,
    sectorState: p.battle,
    survivors: p.battle.units.filter((u) => u.side === 'player'),
  });
};
