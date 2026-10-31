'use client';
import type { CampaignProjectDocument, JsonValue } from '../../../domain/campaign-project.ts';
import {
  assertPhysicalMap,
  assertCampaignContent,
  documentObjects,
  documentObject,
  documentString,
  readBuildingTemplate,
} from '../../lib/editor-documents.ts';
import { editorErrorMessage } from '../../../infrastructure/editor-error-message.ts';
import { useState } from 'react';
import SectorEditor from '../editor/SectorEditor.tsx';
import { DocumentEditor } from './FieldEditor.tsx';
import { projectContent } from '../../../infrastructure/project-operations.js';
import {
  setProjectMap,
  saveProjectBuildingTemplate,
} from '../../../infrastructure/world-editing.js';
export default function MapWorkspace({
  project,
  onChange,
}: {
  project: CampaignProjectDocument;
  onChange: (next: CampaignProjectDocument) => void;
}) {
  const [id, setId] = useState(Object.keys(project.maps)[0] ?? ''),
    [error, setError] = useState('');
  const selected = project.maps[id] ? id : Object.keys(project.maps)[0];
  const document = selected ? project.maps[selected] : undefined;
  let map = null;
  let mapError = '';
  if (document) {
    try {
      assertPhysicalMap(document);
      map = document;
    } catch (error) {
      mapError = editorErrorMessage(error);
    }
  }
  const rawCampaign = projectContent(project);
  let campaign = null;
  try {
    assertCampaignContent(rawCampaign);
    campaign = rawCampaign;
  } catch {}
  const rawTemplates = documentObjects(project.editor?.['buildingTemplates']);
  const templates = rawTemplates.flatMap((value) => {
    try {
      return [readBuildingTemplate(value)];
    } catch {
      return [];
    }
  });
  function change(next: JsonValue) {
    if (!selected) {
      return;
    }
    try {
      assertPhysicalMap(next);
      onChange(setProjectMap(project, selected, next));
      setError('');
    } catch (e) {
      setError(editorErrorMessage(e));
    }
  }
  return (
    <section className="studio-body">
      <h2>Mapas tácticos</h2>
      <p>
        Cada plano mide 20 × 16. El juego expande el plano para formar la escena. Los cambios se
        guardan en este proyecto.
      </p>
      <label>
        Mapa
        <select value={selected ?? ''} onChange={(e) => setId(e.target.value)}>
          {Object.entries(project.maps).map(([id, map]) => (
            <option key={id} value={id}>
              {documentString(documentObject(map['metadata'])['title'], id)} · {id}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {document ? (
        <>
          {map ? (
            <SectorEditor
              key={selected}
              document={map}
              {...(campaign ? { campaign } : {})}
              onDocumentChange={change}
              embedded
              templates={templates}
              onSaveTemplate={(template) =>
                onChange(saveProjectBuildingTemplate(project, template))
              }
            />
          ) : (
            <p role="alert">Corregí el documento para abrir el mapa: {mapError}</p>
          )}
          {templates.length !== rawTemplates.length && (
            <p role="alert">Algunas plantillas necesitan correcciones en sus documentos.</p>
          )}
          <details open={!map}>
            <summary>Campos completos del mapa, niveles y losas</summary>
            <p>
              upperSurfaces define losas y plataformas en metros. climbLinks conecta niveles. Las
              paredes determinan las habitaciones. Los cambios geométricos se validan antes de
              aplicarlos.
            </p>
            <DocumentEditor value={document} onChange={change} path={`maps.${selected}`} />
          </details>
        </>
      ) : (
        <p>Creá una localidad en Mundo para añadir su mapa.</p>
      )}
    </section>
  );
}
