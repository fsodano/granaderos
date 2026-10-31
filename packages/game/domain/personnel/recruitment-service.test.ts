import test from 'node:test';
import assert from 'node:assert/strict';
import { Character } from './character.ts';
import { ForceRoster, RecruitmentAssignment } from './force-roster.ts';
import { ServiceContract } from './service-contract.ts';
import { RecruitmentService } from './recruitment-service.ts';
import { ServicePricingPolicy } from './service-pricing-policy.ts';
import { Money } from '../finance/money.ts';
import { Treasury } from '../finance/treasury.ts';
import { GameTime } from '../shared/game-time.ts';
import { DomainRefusalCode } from '../shared/domain-refusal.ts';

function recruitmentContext({
  funds = 100,
  captured = false,
  members = [] as string[],
  health = 70,
} = {}) {
  return {
    character: Character.restore({
      id: 'ana',
      health,
      maximumHealth: 80,
      alive: health > 0,
      captured,
      locationId: null,
    }),
    roster: new ForceRoster(members, members, 'retiro', 2),
    treasury: new Treasury(Money.pesos(funds)),
    now: GameTime.atSeconds(61),
    terms: {
      term: 'day',
      durationSeconds: 86_400,
      payment: Money.pesos(60),
      guarantee: Money.pesos(10),
    },
    allowedLocations: ['retiro', 'posta'],
  };
}

void test('recruitment admits an existing person immediately and debits pay plus guarantee once', () => {
  const context = recruitmentContext();
  const identity = context.character;
  const result = new RecruitmentService().recruit(context, 'retiro');
  assert.equal(context.character, identity);
  assert.equal(context.character.snapshot().health, 70);
  assert.equal(result.assignment, RecruitmentAssignment.Squad);
  assert.deepEqual(context.roster.members, ['ana']);
  assert.deepEqual(context.roster.squadMembers, ['ana']);
  assert.equal(context.treasury.balance.pesos, 30);
  assert.equal(result.contract.startedAt.seconds, 61);
  assert.equal(result.contract.expiresAt?.seconds, 86_461);
  assert.throws(() => new RecruitmentService().recruit(context, 'retiro'), {
    code: DomainRefusalCode.AlreadyServing,
  });
  assert.equal(context.treasury.balance.pesos, 30);
});

void test('a full squad or a remote site gives an immediately controlled reserve', () => {
  for (const [members, destination] of [
    [['uno', 'dos'], 'retiro'],
    [[], 'posta'],
  ] as const) {
    const context = recruitmentContext({ members: [...members] });
    const result = new RecruitmentService().recruit(context, destination);
    assert.equal(result.assignment, RecruitmentAssignment.Reserve);
    assert.equal(context.character.locationId, destination);
    assert.ok(context.roster.members.includes('ana'));
    assert.ok(!context.roster.squadMembers.includes('ana'));
    assert.equal(context.character.service?.isActiveAt(context.now), true);
  }
});

void test('refused funds, custody, life status and placement leave all domain participants unchanged', () => {
  const cases = [
    {
      context: recruitmentContext({ funds: 69 }),
      location: 'retiro',
      code: DomainRefusalCode.InsufficientFunds,
    },
    {
      context: recruitmentContext({ captured: true }),
      location: 'retiro',
      code: DomainRefusalCode.CharacterUnavailable,
    },
    {
      context: recruitmentContext({ health: 0 }),
      location: 'retiro',
      code: DomainRefusalCode.CharacterUnavailable,
    },
    { context: recruitmentContext(), location: 'enemy', code: DomainRefusalCode.InvalidPlacement },
  ];
  for (const { context, location, code } of cases) {
    const before = {
      person: context.character.snapshot(),
      funds: context.treasury.balance.pesos,
      members: context.roster.members,
    };
    assert.throws(() => new RecruitmentService().recruit(context, location), { code });
    assert.deepEqual(context.character.snapshot(), before.person);
    assert.equal(context.character.service, null);
    assert.equal(context.treasury.balance.pesos, before.funds);
    assert.deepEqual(context.roster.members, before.members);
  }
});

void test('restoring service preserves its original timestamps and rejects an identity mismatch', () => {
  const context = recruitmentContext();
  const outcome = new RecruitmentService().recruit(context, 'retiro');
  const contract = ServiceContract.restore(structuredClone(outcome.contract.snapshot()));
  const restored = Character.restore(context.character.snapshot(), contract);
  assert.equal(restored.service?.startedAt.seconds, 61);
  assert.equal(restored.service?.isActiveAt(GameTime.atSeconds(86_461)), false);
  assert.throws(() => Character.restore({ ...restored.snapshot(), id: 'otro' }, contract));
  assert.throws(() => ServiceContract.start('ana', 'day', context.now, -1, Money.pesos(1)));
});

void test('service pricing applies authored experience increases and currency rounding', () => {
  const pricing = new ServicePricingPolicy({
    salaryMonthDays: 30,
    experienceStep: 100,
    raisePercent: 10,
    priceMultiplier: 6,
  });
  assert.equal(pricing.dailyPay(Money.pesos(301), 0, Money.pesos(0)).pesos, 61);
  assert.equal(pricing.dailyPay(Money.pesos(301), 200, Money.pesos(0)).pesos, 73);
  assert.equal(pricing.dailyPay(Money.pesos(0), 0, Money.pesos(0)).pesos, 0);
  assert.equal(pricing.dailyPay(Money.pesos(0), 0, Money.pesos(1)).pesos, 1);
  assert.throws(() => pricing.dailyPay(Money.pesos(100), -1, Money.pesos(0)));
});
