import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePreferredCompanions,
  validateServiceRefusals,
} from '../packages/campaign-format/character-relationships-schema.js';
import { validateEnvironmentRecord } from '../packages/campaign-format/environment-record-schema.js';
import { validateOfficerCreation } from '../packages/campaign-format/officer-creation-schema.js';
import { validateCampaignPhysical } from '../packages/campaign-format/physical-schema.js';
import { PocketLayout } from '../packages/game/domain/inventory/pocket-layout.ts';

void test('text admission rejects C0 and markup while preserving reason whitespace, DEL and Unicode', () => {
  const characters = new Set(['speaker', 'companion']);
  const samples = [
    ...Array.from({ length: 33 }, (_, code) => String.fromCharCode(code)),
    '<',
    '>',
    String.fromCharCode(127),
    String.fromCharCode(128),
    String.fromCharCode(159),
    'ñ',
    '🧉',
  ];
  for (const character of samples) {
    const value = `before${character}after`;
    const label = JSON.stringify(value);
    const forbidden = character.charCodeAt(0) < 32 || character === '<' || character === '>';
    const invalidReason = forbidden && !['\t', '\n', '\r'].includes(character);
    const relationship = { character: 'companion', reason: value };
    assert.equal(
      validateServiceRefusals({ id: 'speaker', serviceRefusals: [relationship] }, characters)
        .length > 0,
      invalidReason,
      `service refusal: ${label}`,
    );
    assert.equal(
      validatePreferredCompanions(
        { id: 'speaker', preferredCompanions: [relationship] },
        characters,
      ).length > 0,
      invalidReason,
      `preferred companion: ${label}`,
    );
    assert.equal(
      validateOfficerCreation({ biography: value }).length > 0,
      forbidden,
      `officer text: ${label}`,
    );
    assert.equal(
      validateCampaignPhysical(
        {
          version: 1,
          caches: { camp: { chest: value, contents: [] } },
          arsenals: {},
          environment: {},
        },
        { sectors: [{ id: 'camp' }] },
      ).length > 0,
      forbidden,
      `physical identity: ${label}`,
    );
    const environment = () => validateEnvironmentRecord({ type: 'door', keyId: value });
    const pocketOrder = () =>
      PocketLayout.validateOrder([{ slotId: 'small-1', item: value, index: 0 }]);
    if (forbidden) {
      assert.throws(environment, /identificación de la llave/, label);
      assert.throws(pocketOrder, /invalid-pocket-order/, label);
    } else {
      assert.doesNotThrow(environment, label);
      assert.doesNotThrow(pocketOrder, label);
    }
  }
});
