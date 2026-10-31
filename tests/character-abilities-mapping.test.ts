import { present } from './assert-present.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaign, dispatchCampaign, rosterFor } from '../packages/game/campaign.js';
import { rosterFor as characterDefinitions } from '../packages/game/recruitment.ts';
import { legacyCharacterAbilities } from '../packages/game/character-abilities.js';
import { operativeIdForCharacter } from '../packages/game/content-character-ids.ts';
import {
  CharacterAbilities,
  CharacterRating,
} from '../packages/game/domain/personnel/character-abilities.ts';
import {
  RecruitmentCandidate,
  RecruitmentAvailability,
} from '../packages/game/domain/personnel/recruitment-candidate.ts';
import { GameSnapshotMapper } from '../packages/game/infrastructure/persistence/game-snapshot-mapper.js';
import { encodeSave, decodeSave } from '../packages/game/save.ts';
import { postContent } from './post-campaign-fixture.ts';
import { visit } from './local-contract-fixture.ts';

void test('canonical character abilities preserve authored ranges, earned progress, and catalogue ownership through saves', () => {
  const content = postContent();
  const authored = content.characters.find((character) => character.id === 'benicio');
  present(authored).attributes.medical = 100;
  present(authored).attributes.leadership = 0;
  present(authored).abilities = ['rapid_first_aid'];
  present(authored).traits = ['expert_rider'];
  const id = present(operativeIdForCharacter(content, present(authored).id));
  const campaign = initialCampaign(8, content);
  present(campaign.operativeState[id]).trainedStats = { medical: 10, marksmanship: 3 };
  present(campaign.operativeState[id]).strength = 100;
  const source = structuredClone(campaign);
  const mapper = new GameSnapshotMapper(() => 'ability-session');
  const game = mapper.restore(encodeSave(campaign));
  const character = game.personnel.character(String(id));
  const base = characterDefinitions(campaign).find((candidate) => candidate.id === id);
  assert.ok(character.abilities instanceof CharacterAbilities);
  assert.equal(character.abilities.rating(CharacterRating.Medical), 100);
  assert.equal(character.abilities.rating(CharacterRating.Leadership), 0);
  assert.equal(
    character.abilities.rating(CharacterRating.Marksmanship),
    Math.min(100, present(base).marksmanship + 3),
  );
  assert.equal(character.abilities.rating(CharacterRating.Strength), 100);
  assert.equal(character.abilities.hasCapability('rapid_first_aid'), true);
  const candidate = new RecruitmentCandidate({
    characterId: String(id),
    name: present(authored).name,
    nickname: present(authored).nickname,
    role: present(authored).role,
    availability: RecruitmentAvailability.Available,
    dailyPay: 1,
    abilities: character.abilities,
  });
  assert.equal(candidate.abilities, character.abilities);
  assert.equal(candidate.hasSpecialty('medic'), true);
  assert.equal(candidate.hasSpecialty('rider'), true);
  assert.equal(candidate.hasSpecialty('leader'), false);
  const exported = mapper.serialize(game);
  const restored = mapper.restore(exported);
  assert.deepEqual(
    restored.personnel.character(String(id)).abilities.toSnapshot(),
    character.abilities.toSnapshot(),
  );
  const projected = decodeSave(exported).campaign;
  assert.deepEqual(projected.operativeState, source.operativeState);
  assert.deepEqual(projected.contentCampaign, source.contentCampaign);
  assert.equal(projected.resources.treasury, source.resources.treasury);
  assert.deepEqual(campaign, source);
  const projectedCharacter = present(rosterFor(projected).find((candidate) => candidate.id === id));
  const ratings = character.abilities.toSnapshot().ratings;
  for (const name of Object.values(CharacterRating)) {
    assert.equal(projectedCharacter[name], ratings[name]);
  }
});

void test('legacy capabilities restore by definition without adding mutable ability records', () => {
  const campaign = initialCampaign();
  const game = new GameSnapshotMapper(() => 'legacy-abilities').restore(encodeSave(campaign));
  for (const definition of characterDefinitions(campaign)) {
    assert.deepEqual(
      game.personnel.character(String(definition.id)).abilities.toSnapshot().capabilities,
      definition.abilities ?? legacyCharacterAbilities(definition.id),
    );
  }
  assert.ok(
    Object.values(game.snapshot().campaign.operativeState).every(
      (record) => record.abilities === undefined,
    ),
  );
});

void test('active earned skill progress belongs to the same restored character and survives serialization', () => {
  const campaign = dispatchCampaign(initialCampaign(), {
    type: 'recruitCombatant',
    characterId: '110',
    term: 'week',
  });
  assert.equal(campaign.lastError, null);
  const pair = visit(campaign);
  const unit = present(pair.battle).units.find((actor) => actor.id === '110');
  assert.ok(present(unit).marksmanship < 100);
  present(unit).marksmanship += 1;
  present(unit).trainedStats = {
    ...present(unit).trainedStats,
    marksmanship: (present(unit).trainedStats?.['marksmanship'] ?? 0) + 1,
  };
  const mapper = new GameSnapshotMapper(() => 'active-abilities');
  const game = mapper.restore(encodeSave(pair.campaign, pair.battle));
  const character = game.personnel.character('110');
  assert.equal(
    game.participant(present(present(pair.battle).sectorSession).id, '110').character,
    character,
  );
  assert.equal(
    character.abilities.rating(CharacterRating.Marksmanship),
    present(unit).marksmanship,
  );
  const restored = mapper.restore(mapper.serialize(game));
  assert.equal(
    restored.personnel.character('110').abilities.rating(CharacterRating.Marksmanship),
    present(unit).marksmanship,
  );
});
