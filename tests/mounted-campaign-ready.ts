import assert from 'node:assert/strict';
import { act } from 'react';
import { setTimeout as wait } from 'node:timers/promises';
// Await the real async package/resource admission, with a bounded failure.
// The mounted UI exposes its loading state through the accessibility tree.
export async function campaignUIReady(document:Document) {
  const deadline = Date.now() + 10000;
  while (document.querySelector('[aria-busy="true"]')) {
    assert.ok(Date.now() < deadline, 'campaign UI remained busy');
    await act(async () => wait(10));
  }
  await act(async () => {});
}
