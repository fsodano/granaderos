import assert from 'node:assert/strict';
import type { CampaignProjectDocument } from '../domain/campaign-project.ts';
import { assertCampaignProjectEnvelope } from '../domain/project-document.ts';
import {
  assertCampaignWorld,
  assertPhysicalMap,
  documentObject,
  documentObjects,
  isJsonValue,
} from '../web/lib/editor-documents.ts';

export function projectDocument(value: unknown): CampaignProjectDocument {
  return assertCampaignProjectEnvelope(value);
}

export function projectWorld(project: CampaignProjectDocument) {
  const world = project.world;
  assertCampaignWorld(world);
  return world;
}

export function projectMap(project: CampaignProjectDocument, id: string) {
  const map = project.maps[id];
  assert.ok(map);
  assertPhysicalMap(map);
  return map;
}

export function firstCharacter(project: CampaignProjectDocument) {
  const character = documentObjects(project.content['characters'])[0];
  assert.ok(character);
  return character;
}

export function assetEntries(project: CampaignProjectDocument) {
  const assets = documentObject(project.assets)['assets'];
  assert.ok(Array.isArray(assets));
  return assets;
}

export function mapDocument(value: unknown) {
  assert.ok(isJsonValue(value));
  assertPhysicalMap(value);
  return value;
}
