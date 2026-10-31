import test from 'node:test';
import assert from 'node:assert/strict';
import { Squad } from './squad.ts';
import { SquadFormationService } from './squad-formation-service.ts';

function squad(id: string, members: string[], locked = false, locationId = 'retiro') {
  return new Squad({
    id,
    name: `Escuadra ${id}`,
    memberIds: members,
    locationId,
    membershipLocked: locked,
  });
}
const candidates = ['one', 'two', 'three'].map((characterId) => ({
  characterId,
  locationId: 'retiro',
  available: true,
}));

void test('forming a squad transfers only selected members and preserves physical locations', () => {
  const first = squad('first', ['one', 'two']);
  const second = squad('second', ['three']);
  const formed = Squad.form('third', 'Nueva escuadra', 'retiro');
  const result = new SquadFormationService().form(
    [first, second],
    formed,
    ['one', 'three'],
    candidates,
  );
  assert.deepEqual(first.memberIds, ['two']);
  assert.deepEqual(second.memberIds, []);
  assert.deepEqual(formed.memberIds, ['one', 'three']);
  assert.ok(result.squads.every((squad) => squad.locationId === 'retiro'));
  const exposed = formed.memberIds as string[];
  exposed.push('foreign');
  assert.deepEqual(formed.memberIds, ['one', 'three']);
});

void test('locked source, duplicate selection, absent candidate and location mismatch refuse before membership changes', () => {
  for (const failure of ['locked', 'duplicate', 'absent', 'location']) {
    const first = squad('first', ['one'], failure === 'locked');
    const target = squad('target', ['two']);
    const before = [first, target].map((squad) => squad.toSnapshot());
    const ids = failure === 'duplicate' ? ['one', 'one'] : ['one'];
    const available =
      failure === 'absent'
        ? []
        : candidates.map((candidate) => ({
            ...candidate,
            locationId: failure === 'location' ? 'san_lorenzo' : 'retiro',
          }));
    assert.throws(() => new SquadFormationService().form([first, target], target, ids, available));
    assert.deepEqual(
      [first, target].map((squad) => squad.toSnapshot()),
      before,
    );
  }
});

void test('a full force can replace a vacant squad, but cannot exceed its squad count', () => {
  const squads = Array.from({ length: 8 }, (_, index) => squad(String(index), [String(index)]));
  const target = Squad.form('new', 'Reserva', 'retiro');
  const available = [{ characterId: '0', locationId: 'retiro', available: true }];
  assert.throws(
    () => new SquadFormationService().form(squads, target, ['0'], available),
    /too-many-squads/,
  );
  const vacantSquad = squads[7];
  assert.ok(vacantSquad);
  vacantSquad.replaceMembers([]);
  const formed = new SquadFormationService().form(squads, target, ['0'], available);
  assert.equal(formed.squads.length, 8);
  assert.equal(formed.discardedSquadId, '7');
});
