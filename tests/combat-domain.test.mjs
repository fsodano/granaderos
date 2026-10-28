import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Firearm,
  FirearmDischarge,
  FirearmRefusalCode,
  IgnitionPolicy,
} from '../game/domain/combat/firearm.ts';
import { ReloadWork } from '../game/domain/combat/reload-work.ts';
import { ReprimeWork } from '../game/domain/combat/reprime-work.ts';
import { BodyRegion } from '../game/domain/combat/body-region.ts';
import { CombatInjury } from '../game/domain/combat/combat-injury.ts';
import { CombatTurn, MaximumAutomaticActionsPerTurn } from '../game/domain/combat/combat-turn.ts';
import { ReactionPolicy } from '../game/domain/combat/reaction-policy.ts';
import { ReactionWindow, ReactionReturn } from '../game/domain/combat/reaction-window.ts';
import { ReactionStack } from '../game/domain/combat/reaction-stack.ts';
import { SectorParticipant } from '../game/domain/sector-sessions/sector-participant.ts';
import { MeleeExchange } from '../game/domain/combat/melee-exchange.ts';
import { CombatOutcomePolicy } from '../game/domain/combat/combat-outcome-policy.ts';
test('a misfire preserves its physical charge and a successful discharge consumes it exactly once', () => {
  const gun = new Firearm({ loaded: 1, condition: 70, jammed: false });
  assert.equal(gun.tryDischarge(30, 0.2), FirearmDischarge.Misfire);
  assert.deepEqual(gun.snapshot(), { loaded: 1, condition: 70, jammed: true });
  assert.throws(() => gun.tryDischarge(30, 0.9), { code: FirearmRefusalCode.Jammed });
  gun.reprime();
  assert.equal(gun.tryDischarge(30, 0.9), FirearmDischarge.Fired);
  assert.deepEqual(gun.snapshot(), { loaded: 0, condition: 69, jammed: false });
  assert.throws(() => gun.tryDischarge(0, 0.9), { code: FirearmRefusalCode.Unloaded });
  const ignition = new IgnitionPolicy();
  assert.ok(ignition.baseRisk(30, 80, 20) > ignition.baseRisk(100, 0, 0));
});
test('reload preserves fractional work and consumes reserve only when a charge completes', () => {
  const first = new ReloadWork({ loaded: 0, reserve: 2, capacity: 2, roundCost: 45 }).plan(13.5);
  assert.equal(first.rounds, 0);
  assert.equal(first.progress, 0.3);
  const second = new ReloadWork({
    loaded: 0,
    reserve: 2,
    capacity: 2,
    progress: first.progress,
    roundCost: 45,
  }).plan(31.5);
  assert.equal(second.rounds, 1);
  assert.equal(second.progress, 0);
  const zero = new ReloadWork({ loaded: 0, reserve: 0, capacity: 2, roundCost: 45 }).plan(Infinity);
  assert.equal(zero.rounds, 0);
  assert.throws(() => new ReloadWork({ loaded: 3, reserve: 1, capacity: 2, roundCost: 45 }), {
    code: FirearmRefusalCode.InvalidWork,
  });
});
test('reprime plans only complete pan work that fits the current budget', () => {
  const work = new ReprimeWork(['primary', 'offhand'], false);
  assert.deepEqual(work.plan(20).hands, ['primary']);
  assert.equal(work.plan(14).pa, 0);
  assert.equal(work.plan(Infinity).pa, 30);
});
test('body region and combat injury keep actual health loss, breath, bleeding and balance consistent', () => {
  const impact = BodyRegion.named('legs').impact(50, {
    health: 100,
    stance: 'standing',
    mounted: true,
  });
  assert.equal(impact.damage, 33);
  assert.equal(impact.knockedDown, true);
  assert.equal(impact.unhorse, true);
  const injury = new CombatInjury(impact).inflict({
    health: { current: 100, maximum: 100, bleeding: 0, bandaged: 0 },
    energy: 100,
    shock: 0,
    morale: 80,
  });
  assert.equal(injury.healthLost, 33);
  assert.equal(injury.condition.health.current, 67);
  assert.equal(injury.condition.health.bleeding, 3);
  assert.equal(injury.balanceLoss, 25);
  const fatal = new CombatInjury(BodyRegion.named('head').impact(100, { health: 20 })).inflict({
    health: { current: 20, maximum: 100, bleeding: 4, bandaged: 0 },
    energy: 10,
    shock: 0,
    morale: 80,
  });
  assert.equal(fatal.healthLost, 20);
  assert.equal(fatal.died, true);
  assert.equal(fatal.condition.health.bleeding, 0);
  assert.equal(fatal.condition.energy, 0);
});
test('combat turn issues budgets once and persists bounded actor progress', () => {
  const turn = CombatTurn.begin(['one', 'two']);
  assert.deepEqual(turn.takeUnissuedBudgets(), ['one', 'two']);
  assert.deepEqual(turn.takeUnissuedBudgets(), []);
  for (let action = 0; action < MaximumAutomaticActionsPerTurn; action++) turn.recordAction();
  assert.equal(turn.canAct, false);
  assert.throws(() => turn.recordAction());
  turn.finishCurrentParticipant();
  assert.equal(turn.currentCharacterId, 'two');
  const restored = CombatTurn.restore(turn.snapshot());
  restored.finishCurrentParticipant(true);
  assert.equal(restored.complete, true);
  assert.equal(turn.complete, false);
});
test('reaction eligibility uses prior observations, initiative, remaining AP and one reaction per round', () => {
  const policy = new ReactionPolicy(),
    observer = {
      characterId: 'one',
      capable: true,
      knockedDown: false,
      alreadyReacted: false,
      actionPoints: 3,
      overwatchEnabled: true,
      playerControlled: true,
      initiative: 20,
      seesActor: true,
      sawActorBefore: false,
      newSound: false,
      distance: 7,
      tacticalCommand: false,
      strategicCommand: false,
    };
  const trigger = { initiative: 20, moved: false };
  assert.deepEqual(policy.qualifiedObservers([observer], trigger), ['one']);
  for (const update of [
    { alreadyReacted: true },
    { actionPoints: 2 },
    { initiative: 19 },
    { distance: 9 },
    { sawActorBefore: true },
  ])
    assert.deepEqual(policy.qualifiedObservers([{ ...observer, ...update }], trigger), []);
  assert.deepEqual(
    policy.qualifiedObservers(
      [{ ...observer, seesActor: false, newSound: true, distance: 30 }],
      trigger,
    ),
    ['one'],
  );
});
test('nested reactions preserve the exact parent control window without issuing fresh AP', () => {
  const window = ReactionWindow.open(['player-one'], 'enemy-one', ReactionReturn.EnemyTurn);
  const stack = new ReactionStack([], 4);
  stack.suspend(['enemy-two'], 'interrupt', window);
  stack.currentTurn.recordAction();
  const restored = new ReactionStack(JSON.parse(JSON.stringify(stack.snapshot())), 4);
  restored.currentTurn.finishCurrentParticipant();
  const resumed = restored.completeCurrent();
  assert.equal(resumed.phase, 'interrupt');
  assert.equal(resumed.window.triggeringCharacterId, 'enemy-one');
  assert.equal(restored.empty, true);
  const parent = ReactionWindow.restore(resumed.window);
  assert.equal(parent.allows('player-one'), true);
  assert.equal(parent.allows('someone-else'), false);
  for (let action = 0; action < MaximumAutomaticActionsPerTurn; action++)
    parent.recordAutomaticAction('player-one');
  assert.equal(parent.canActAutomatically('player-one'), false);
});
test('melee parry and counterattack pay from the same participant budget', () => {
  const defender = SectorParticipant.restore({
      characterId: 'defender',
      actionPoints: 30,
      maximumActionPoints: 100,
      carriedActionPoints: 0,
    }),
    exchange = new MeleeExchange(40);
  const defended = exchange.defend(defender, {
    canParry: true,
    alreadyParried: false,
    protectedFromBlow: true,
  });
  assert.equal(defended.damage, 24);
  assert.equal(defender.actionPoints, 24);
  const context = {
    enabled: true,
    defenderCapable: true,
    attackerCapable: true,
    usableWeapon: true,
    upright: true,
    trained: true,
    alreadyCountered: false,
    withinReach: true,
    cost: 20,
    damage: 30,
  };
  assert.equal(exchange.counterattack(defender, context).damage, 15);
  assert.equal(defender.actionPoints, 4);
  assert.equal(exchange.counterattack(defender, context), null);
});
test('combat ends only when a side cannot remain on the field, including recoverable exhaustion', () => {
  const policy = new CombatOutcomePolicy(),
    player = { side: 'player', health: 100, departed: false, fled: false, surrendered: false },
    enemy = { ...player, side: 'enemy' };
  assert.equal(policy.evaluate([player, enemy]), 'active');
  assert.equal(policy.evaluate([player, { ...enemy, surrendered: true }]), 'victory');
  assert.equal(policy.evaluate([{ ...player, departed: true }, enemy]), 'retreat');
  assert.equal(policy.evaluate([{ ...player, health: 0 }, enemy]), 'defeat');
});
