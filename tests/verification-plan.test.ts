import assert from 'node:assert/strict';
import test from 'node:test';
import { runStages, stagesFor } from '../tools/verification-plan.ts';

void test('verification stops on the first failed check and preserves its exit status', () => {
  const executed: string[] = [];
  const status = runStages(['lint', 'typecheck', 'test'], (stage) => {
    executed.push(stage);
    return stage === 'typecheck' ? 7 : 0;
  });
  assert.equal(status, 7);
  assert.deepEqual(executed, ['lint', 'typecheck']);
});

void test('full verification includes every push check and the production export', () => {
  assert.deepEqual(stagesFor('full'), [...stagesFor('push'), 'build']);
  assert.ok(stagesFor('push').includes('test'));
  assert.ok(stagesFor('push').includes('typecheck'));
  assert.ok(stagesFor('push').includes('audit:baseline'));
  assert.throws(() => stagesFor('quick-but-skip-tests'));
  const edited = stagesFor('push');
  edited.pop();
  assert.notDeepEqual(edited, stagesFor('push'));
});
