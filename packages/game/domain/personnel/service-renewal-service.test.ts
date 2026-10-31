import test from 'node:test';
import assert from 'node:assert/strict';
import { Character } from './character.ts';
import { ServiceContract } from './service-contract.ts';
import { ServiceRenewalService } from './service-renewal-service.ts';
import { Money } from '../finance/money.ts';
import { Treasury } from '../finance/treasury.ts';
import { GameTime } from '../shared/game-time.ts';

function context(funds = 100, permanent = false) {
  const service = ServiceContract.start(
    'person',
    'day',
    GameTime.atSeconds(17),
    permanent ? null : 86400,
    Money.pesos(20),
  );
  const character = Character.restore(
    {
      id: 'person',
      health: 80,
      maximumHealth: 100,
      alive: true,
      captured: false,
      locationId: 'retiro',
    },
    service,
  );
  return {
    character,
    treasury: new Treasury(Money.pesos(funds)),
    now: GameTime.atSeconds(3600),
    term: 'week',
    durationSeconds: 604800,
    payment: Money.pesos(40),
  };
}

void test('renewal banks all remaining service seconds and pays once through the same character', () => {
  const renewal = context();
  const character = renewal.character;
  const contract = new ServiceRenewalService().renew(renewal);
  assert.ok(contract.expiresAt);
  assert.equal(contract.expiresAt.seconds, 691217);
  assert.equal(contract.startedAt.seconds, 3600);
  assert.equal(character.service, contract);
  assert.equal(renewal.treasury.balance.pesos, 60);
});

void test('refused renewal leaves the person and treasury unchanged', () => {
  for (const renewal of [context(10), context(100, true), { ...context(), durationSeconds: 0 }]) {
    const before = renewal.character.service;
    const funds = renewal.treasury.balance.pesos;
    assert.throws(() => new ServiceRenewalService().renew(renewal));
    assert.equal(renewal.character.service, before);
    assert.equal(renewal.treasury.balance.pesos, funds);
  }
});

void test('health belongs to the character and service termination preserves the person and its wounds', () => {
  const renewal = context();
  const injury = renewal.character.health.sufferInjury(18, 2);
  assert.equal(injury.healthLost, 18);
  const health = renewal.character.health;
  const ended = renewal.character.endService();
  assert.equal(ended.characterId, renewal.character.id);
  assert.equal(renewal.character.health, health);
  assert.equal(renewal.character.snapshot().health, 62);
  assert.equal(renewal.character.snapshot().bleeding, 2);
  assert.equal(renewal.character.service, null);
  assert.throws(() => renewal.character.endService(), /not-serving/);
});
