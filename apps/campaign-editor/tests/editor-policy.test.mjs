import {
  CampaignEditorRefusal,
  CampaignEditorRefusalCode,
} from '../domain/campaign-editor-refusal.ts';
import { editorErrorMessage } from '../infrastructure/editor-error-message.ts';
import { EditSectorMapUseCase } from '../application/edit-sector-map/edit-sector-map.use-case.ts';
import { SectorMapEditingRepository } from '../infrastructure/sector-map-editing-repository.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CampaignProject } from '../domain/campaign-project.ts';
import { CampaignWorld } from '../domain/campaign-world.js';
import { CampaignMap } from '../domain/campaign-map.js';
import { SectorMap } from '../domain/sector-map.js';
import { CampaignProjectEditingRepository } from '../infrastructure/campaign-project-editing-repository.ts';
import { EditCampaignProjectUseCase } from '../application/edit-campaign-project/edit-campaign-project.use-case.ts';
import { UndoCampaignProjectEditUseCase } from '../application/undo-campaign-project-edit/undo-campaign-project-edit.use-case.ts';
import { RedoCampaignProjectEditUseCase } from '../application/redo-campaign-project-edit/redo-campaign-project-edit.use-case.ts';
import { sectorMapGeometry } from '../infrastructure/sector-map-geometry.js';
import { createCampaignProject } from '../infrastructure/create-project.js';
import { blankMap } from '../../../packages/game/public/campaign-editor-api.js';
import {
  createSectorMapHistory,
  editSectorMap,
  undoSectorMapEdit,
  redoSectorMapEdit,
} from '../public/map-editing-api.js';

test('studio edits, identity changes and undo share one revision and reject stale callbacks after opening another project', async () => {
  const document = await createCampaignProject('open-project', 'Opened');
  const repository = new CampaignProjectEditingRepository();
  repository.open(new CampaignProject(document));
  const edit = new EditCampaignProjectUseCase(repository);
  const revision = repository.snapshot().revision;
  edit.execute({
    projectId: 'open-project',
    revision,
    edit: { kind: 'rename', identifier: 'renamed-project', name: 'Renamed' },
  });
  assert.equal(repository.snapshot().revision, revision + 1);
  const undo = new UndoCampaignProjectEditUseCase(repository);
  undo.execute({ projectId: 'renamed-project', revision: revision + 1 });
  assert.equal(repository.snapshot().current.manifest.id, 'open-project');
  assert.equal(
    repository.snapshot().current.content.characters[0].portrait,
    '/campaigns/open-project/assets/guide.png',
  );
  new RedoCampaignProjectEditUseCase(repository).execute({
    projectId: 'open-project',
    revision: revision + 2,
  });
  assert.equal(repository.snapshot().current.manifest.id, 'renamed-project');
  repository.open(new CampaignProject(document));
  const before = repository.snapshot();
  assert.throws(() =>
    edit.execute({
      projectId: 'open-project',
      revision,
      edit: { kind: 'replace-draft', document },
    }),
  );
  assert.deepEqual(repository.snapshot(), before);
});

test('locality moves and edits keep anchor, district, place and map title consistent', async () => {
  const document = await createCampaignProject('world-project', 'World');
  const world = new CampaignWorld(document);
  const destination = document.world.cells.find((cell) => cell.land && !cell.locality);
  world.moveLocality('watch-post', destination.id);
  world.updateLocality('watch-post', { name: 'Guardia nueva', biome: 'forest' });
  const result = world.snapshot();
  const locality = result.world.sectors.find((entry) => entry.id === 'watch-post');
  const anchor = result.world.cells.find((cell) => cell.anchor && cell.locality === 'watch-post');
  assert.equal(anchor.id, destination.id);
  assert.equal(anchor.name, locality.name);
  assert.equal(anchor.biome, locality.biome);
  assert.equal(result.world.places['watch-post'].label, locality.name);
  assert.equal(result.maps['watch-post'].metadata.title, locality.name);
  assert.equal(
    result.world.districts['watch-post'].filter(
      (district) => district.col === anchor.col && district.row === anchor.row,
    ).length,
    1,
  );
  const before = world.snapshot();
  assert.throws(() => world.updateCell(anchor.id, { land: false }));
  assert.deepEqual(world.snapshot(), before);
  assert.notEqual(
    document.world.sectors.find((entry) => entry.id === 'watch-post').name,
    locality.name,
  );
});

test('world refuses disconnected links and referenced deletion without partial mutations', async () => {
  const document = await createCampaignProject('world-refusal', 'World');
  const world = new CampaignWorld(document);
  assert.throws(() => world.deleteLocality('camp'), {
    code: CampaignEditorRefusalCode.LocalityInUse,
  });
  assert.deepEqual(world.snapshot(), document);
  const separated = structuredClone(document);
  for (const cell of separated.world.cells) cell.land = Boolean(cell.anchor);
  const disconnected = new CampaignWorld(separated);
  assert.throws(() => disconnected.connectLocalities('camp', 'watch-post', true), {
    code: CampaignEditorRefusalCode.LocalitiesDisconnected,
  });
  assert.deepEqual(disconnected.snapshot(), separated);
});

test('map edit batch owns nested movement and rejects all commands if a later command fails', () => {
  const map = new SectorMap(blankMap(), sectorMapGeometry);
  const first = map.edit([
    { type: 'addBuilding', building: { id: 'house', x: 2, y: 2, width: 5, height: 5 } },
    { type: 'addObject', layer: 'props', object: { id: 'chest', type: 'chest', x: 3, y: 3 } },
    {
      type: 'addObject',
      layer: 'items',
      object: { id: 'supply', type: 'ammo', count: 3, x: 3, y: 3, containerId: 'chest' },
    },
  ]);
  assert.deepEqual(first.errors, []);
  const moved = map.edit([{ type: 'moveObject', id: 'house', x: 9, y: 2 }]);
  assert.deepEqual(moved.errors, []);
  assert.equal(moved.document.props[0].x, 10);
  assert.equal(moved.document.items[0].x, 10);
  const before = map.snapshot();
  const refused = map.edit([
    { type: 'setMetadata', values: { title: 'Must rollback' } },
    { type: 'moveObject', id: 'missing', x: 0, y: 0 },
  ]);
  assert.equal(refused.refusal.code, CampaignEditorRefusalCode.ObjectNotFound);
  assert.deepEqual(refused.refusal.details, { id: 'missing' });
  assert.deepEqual(refused.errors, []);
  assert.deepEqual(map.snapshot(), before);
  const stale = map.edit([{ type: 'deleteObject', id: 'house' }], { expectedRevision: 0 });
  assert.equal(stale.refusal.code, CampaignEditorRefusalCode.StaleMapRevision);
  assert.deepEqual(map.snapshot(), before);
});

test('standalone map edit contract preserves history and drops a redo branch on a new edit', () => {
  let history = createSectorMapHistory(blankMap());
  history = editSectorMap(history, [{ type: 'setMetadata', values: { title: 'First' } }]);
  history = editSectorMap(history, [{ type: 'setMetadata', values: { title: 'Second' } }]);
  history = undoSectorMapEdit(history);
  assert.equal(history.document.metadata.title, 'First');
  assert.equal(history.document.revision, 3);
  history = redoSectorMapEdit(history);
  assert.equal(history.document.metadata.title, 'Second');
  history = undoSectorMapEdit(history);
  history = editSectorMap(history, [{ type: 'setMetadata', values: { title: 'Third' } }]);
  assert.equal(history.future.length, 0);
  assert.equal(history.document.revision, 6);
});

test('campaign map refuses incompatible identity and inaccessible slab without changing its document', () => {
  const map = new CampaignMap(blankMap({ id: 'camp' }));
  const before = map.snapshot();
  assert.throws(() => map.replace({ ...before, id: 'other' }));
  assert.deepEqual(map.snapshot(), before);
  const shaped = new SectorMap(blankMap({ id: 'camp' }), sectorMapGeometry);
  shaped.edit([{ type: 'addBuilding', building: { id: 'house', x: 2, y: 2 } }]);
  const withBuilding = new CampaignMap(shaped.snapshot());
  assert.throws(() =>
    withBuilding.setBuildingSlab(
      'house',
      { elevation: 3 },
      { isClear: () => false, build: () => assert.fail('must not build inaccessible slab') },
    ),
  );
  assert.deepEqual(withBuilding.snapshot(), shaped.snapshot());
});

test('typed map refusal preserves accepted history and the public adapter translates it', () => {
  const history = createSectorMapHistory(blankMap());
  const repository = new SectorMapEditingRepository(history);
  const application = new EditSectorMapUseCase(repository);
  const before = repository.snapshot();
  const result = application.execute({
    mapId: history.document.id,
    revision: 0,
    commands: [{ type: 'moveObject', id: 'missing', x: 1, y: 1 }],
  });
  assert.equal(result.refusal.code, CampaignEditorRefusalCode.ObjectNotFound);
  assert.deepEqual(repository.snapshot(), before);
  const translated = editSectorMap(history, [{ type: 'moveObject', id: 'missing', x: 1, y: 1 }]);
  assert.deepEqual(translated.errors, ['Objeto desconocido: missing']);
  assert.equal(translated.document.revision, 0);
  assert.equal(translated.past.length, 0);
  const stale = application.execute({
    mapId: history.document.id,
    revision: 99,
    commands: [{ type: 'setMetadata', values: { title: 'Not admitted' } }],
  });
  assert.equal(stale.refusal.code, CampaignEditorRefusalCode.StaleMapRevision);
  assert.deepEqual(repository.snapshot(), before);
  const malformed = new SectorMap(history.document, sectorMapGeometry).edit([null]);
  assert.equal(malformed.refusal.code, CampaignEditorRefusalCode.InvalidMapCommandBatch);
});

test('editor rule refusals retain stable codes and immutable details across translation', async () => {
  const references = ['dialogue'];
  const refusal = new CampaignEditorRefusal(CampaignEditorRefusalCode.LocalityInUse, {
    references,
  });
  references.push('unrelated');
  assert.deepEqual(refusal.details.references, ['dialogue']);
  assert.equal(
    editorErrorMessage(refusal),
    'Reasigná las referencias antes de eliminar: dialogue.',
  );
  assert.equal(
    editorErrorMessage(structuredClone(refusal.snapshot())),
    editorErrorMessage(refusal),
  );
  assert.equal(editorErrorMessage(new Error('Schema report')), 'Schema report');
  const project = new CampaignProject(await createCampaignProject('typed-refusal', 'Typed'));
  assert.throws(() => project.rename('granaderos'), {
    code: CampaignEditorRefusalCode.ReservedProjectIdentity,
  });
  assert.throws(() => project.rename('../unsafe'), {
    code: CampaignEditorRefusalCode.InvalidProjectIdentity,
  });
});
