import test from 'node:test';
import assert from 'node:assert/strict';
import { captiveServiceHours, restoredCaptiveContract } from './captive-service.ts';

const capturedContract = {
  kind: 'contract',
  term: 'month',
  started: 5,
  startedSecond: 0,
  paid: 120,
};

void test('a combatant who was never captured has no remaining hours', () => {
  assert.equal(captiveServiceHours({ captured: false, capturedAt: 4 }), undefined);
  assert.equal(captiveServiceHours({ capturedAt: 4 }), undefined);
});

void test('a captive whose contract never expires has an unbounded remainder', () => {
  assert.equal(
    captiveServiceHours({
      captured: true,
      capturedAt: 10,
      capturedAtSecond: 1800,
      capturedContract: { ...capturedContract, expiresAt: null },
    }),
    null,
  );
});

void test('a captive whose contract expires has the hours between capture and expiry', () => {
  // Captured at 10h 1800s, expiring at 20h 900s: 35100 seconds, or 9.75 hours.
  assert.equal(
    captiveServiceHours({
      captured: true,
      capturedAt: 10,
      capturedAtSecond: 1800,
      capturedContract: { ...capturedContract, expiresAt: 20, expiresSecond: 900 },
    }),
    9.75,
  );
});

void test('a released contract expires at the release plus the hours left', () => {
  // 9.75 hours left from hour 100 and second 2700: 360000 + 2700 + 35100 = 397800,
  // which is hour 110 and second 1800.
  assert.deepEqual(
    restoredCaptiveContract(
      {
        captured: true,
        capturedAt: 10,
        capturedAtSecond: 1800,
        capturedContract: {
          ...capturedContract,
          expiresAt: 20,
          expiresSecond: 900,
          departurePending: true,
        },
      },
      100,
      2700,
    ),
    { ...capturedContract, expiresAt: 110, expiresSecond: 1800 },
  );
});

void test('a release at a whole hour keeps the seconds of the expiry', () => {
  // Captured at 10h 1800s with a contract expiring at 20h 0s: 34200 seconds,
  // or 9.5 hours. Released at hour 100 and second 0, it expires at 394200,
  // which is hour 109 and second 1800.
  assert.deepEqual(
    restoredCaptiveContract(
      {
        captured: true,
        capturedAt: 10,
        capturedAtSecond: 1800,
        capturedContract: {
          ...capturedContract,
          expiresAt: 20,
          expiresSecond: 0,
          departurePending: true,
        },
      },
      100,
      0,
    ),
    { ...capturedContract, expiresAt: 109, expiresSecond: 1800 },
  );
});

void test('releasing a captive with no contract left raises the same refusal', () => {
  assert.throws(() => restoredCaptiveContract({ capturedAt: 4 }, 100), {
    message: 'El combatiente no tiene un contrato en cautiverio.',
  });
  assert.throws(() => restoredCaptiveContract({ capturedAt: 4 }, 100, 2700), {
    message: 'El combatiente no tiene un contrato en cautiverio.',
  });
});
