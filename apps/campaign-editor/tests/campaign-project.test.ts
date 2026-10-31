import { firstCharacter, assetEntries } from './project-fixtures.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CampaignProject } from '../domain/campaign-project.ts';
import { CampaignProjectHistory } from '../domain/campaign-project-history.ts';
import { createCampaignProject } from '../infrastructure/create-project.js';
import { validateCampaignProject } from '../infrastructure/project-validation.js';
import { encodeCampaignProject, decodeCampaignProject } from '../domain/project-document.ts';
import { InMemoryCampaignProjectRepository } from '../infrastructure/in-memory-campaign-project-repository.ts';
import { EditCampaignProjectUseCase } from '../application/edit-campaign-project/edit-campaign-project.use-case.ts';
import { ValidateCampaignProjectUseCase } from '../application/validate-campaign-project/validate-campaign-project.use-case.ts';

await test('a draft accepts incomplete authored content and retains valid project identity', async () => {
  const project = new CampaignProject(await createCampaignProject('draft-test', 'Draft'));
  const content = project.previewContent();
  content['characters'] = [];
  content['weapons'] = [{ id: 'incomplete' }];
  content['id'] = 'wrong-owner';
  project.replaceContent(content);
  assert.equal(project.snapshot().content['id'], project.id);
  const restored = new CampaignProject(
    decodeCampaignProject(encodeCampaignProject(project.snapshot())),
  );
  assert.deepEqual(restored.snapshot(), project.snapshot());
  assert.equal((await validateCampaignProject(restored.snapshot())).valid, false);
});

await test('project identity changes update owned asset references and cannot leak mutable state', async () => {
  const input = await createCampaignProject('source-project', 'Source');
  const project = new CampaignProject(input);
  project.rename('renamed-project', 'Renamed');
  const snapshot = project.snapshot();
  assert.equal(snapshot.content['id'], 'renamed-project');
  assert.equal(firstCharacter(snapshot)['portrait'], '/campaigns/renamed-project/assets/guide.png');
  snapshot.manifest.id = 'modified-copy';
  firstCharacter(input)['name'] = 'Modified input';
  assert.equal(project.id, 'renamed-project');
  assert.notEqual(firstCharacter(project.snapshot())['name'], 'Modified input');
  assert.throws(() => project.rename('../unsafe'));
  assert.equal(project.id, 'renamed-project');
});

await test('history owns isolated snapshots, supports undo/redo and drops a changed future', async () => {
  const project = new CampaignProject(await createCampaignProject('history-test', 'First'));
  const history = new CampaignProjectHistory(2);
  history.record(project);
  project.rename(project.id, 'Second');
  history.record(project);
  assert.equal(history.undo()?.snapshot().manifest['name'], 'First');
  assert.equal(history.redo()?.snapshot().manifest['name'], 'Second');
  history.undo();
  project.rename(project.id, 'Third');
  history.record(project);
  assert.equal(history.canRedo, false);
  assert.equal(history.undo()?.snapshot().manifest['name'], 'First');
});

await test('use-case repository commits one project revision and rejects stale edits atomically', async () => {
  const project = new CampaignProject(await createCampaignProject('revision-test', 'Initial'));
  const repository = new InMemoryCampaignProjectRepository([project]);
  const edit = new EditCampaignProjectUseCase(repository);
  const accepted = edit.execute({
    projectId: project.id,
    revision: 0,
    edit: { kind: 'rename', identifier: project.id, name: 'Accepted' },
  });
  assert.equal(accepted.revision, 1);
  assert.throws(() =>
    edit.execute({
      projectId: project.id,
      revision: 0,
      edit: { kind: 'rename', identifier: project.id, name: 'Stale' },
    }),
  );
  assert.equal(repository.load(project.id).project.snapshot().manifest['name'], 'Accepted');
  const validate = new ValidateCampaignProjectUseCase(repository, {
    validate: validateCampaignProject,
  });
  assert.equal((await validate.execute({ projectId: project.id })).valid, true);
  assert.equal(repository.load(project.id).revision, 1);
});

await test('resource admission rejects invalid paths and preserves bytes through project persistence', async () => {
  const project = new CampaignProject(await createCampaignProject('resource-test', 'Resources'));
  const before = project.snapshot();
  await assert.rejects(project.replaceResource('../escape.png', new Uint8Array([1])));
  assert.deepEqual(project.snapshot(), before);
  await project.replaceResource('assets/settings.json', new TextEncoder().encode('{"size":2}'));
  assert.equal(assetEntries(project.snapshot()).length, 2);
  const restored = new CampaignProject(
    decodeCampaignProject(encodeCampaignProject(project.snapshot())),
  );
  assert.deepEqual(restored.snapshot().resources, project.snapshot().resources);
});
