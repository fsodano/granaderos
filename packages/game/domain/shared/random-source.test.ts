import test from 'node:test';
import assert from 'node:assert/strict';
import { RandomSource } from './random-source.ts';
import { DomainRefusal, DomainRefusalCode } from './domain-refusal.ts';

const SEED = 1812;

function invalidValue(error: unknown): boolean {
  return error instanceof DomainRefusal && error.code === DomainRefusalCode.InvalidValue;
}

void test('the source reproduces the campaign sequence for seed 1812', () => {
  const source = RandomSource.create(SEED);
  assert.equal(source.next(), 0.9383129708003253);
  assert.equal(source.next(), 0.6337893842719495);
  assert.equal(source.next(), 0.5109232396353036);
  assert.equal(source.next(), 0.7415219265967607);
});

void test('a seed that is not an unsigned 32-bit integer is refused', () => {
  for (const seed of [1812.5, -1, 4294967296, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => RandomSource.create(seed), invalidValue);
    assert.throws(() => RandomSource.restore({ seed }), invalidValue);
  }
  assert.ok(RandomSource.create(0) instanceof RandomSource);
  assert.ok(RandomSource.create(4294967295) instanceof RandomSource);
});

void test('integer draws stay inside the requested range and invalid ranges are refused', () => {
  const source = RandomSource.create(SEED);
  for (let draw = 0; draw < 100; draw += 1) {
    const exclusive = source.nextInt(6);
    assert.ok(Number.isInteger(exclusive));
    assert.ok(exclusive >= 0 && exclusive < 6);
    const inclusive = source.nextIntBetween(3, 7);
    assert.ok(Number.isInteger(inclusive));
    assert.ok(inclusive >= 3 && inclusive <= 7);
  }
  for (const maximum of [0, -1, 2.5]) {
    assert.throws(() => source.nextInt(maximum), invalidValue);
  }
  const ranges: [number, number][] = [
    [5, 3],
    [1.5, 3],
    [1, 3.5],
  ];
  for (const [minimum, maximum] of ranges) {
    assert.throws(() => source.nextIntBetween(minimum, maximum), invalidValue);
  }
});

void test('a source restored from its snapshot repeats the same values', () => {
  const source = RandomSource.create(SEED);
  const saved = source.snapshot();
  assert.equal(saved.seed, SEED);
  const values = [source.next(), source.next(), source.next()];
  const restored = RandomSource.restore(saved);
  assert.deepEqual([restored.next(), restored.next(), restored.next()], values);
});

void test('a snapshot taken after draws continues the sequence from that point', () => {
  const source = RandomSource.create(SEED);
  source.next();
  source.next();
  source.next();
  const restored = RandomSource.restore(source.snapshot());
  assert.deepEqual(
    [restored.next(), restored.next(), restored.next()],
    [source.next(), source.next(), source.next()],
  );
});
