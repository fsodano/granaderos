'use client';
import { editorErrorMessage } from '../../../infrastructure/editor-error-message.ts';
import { useMemo, useState } from 'react';
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
  project: any;
  onChange: (next: any) => void;
}) {
  const [id, setId] = useState(Object.keys(project.maps)[0] ?? ''),
    [error, setError] = useState('');
  const selected = project.maps[id] ? id : Object.keys(project.maps)[0],
    document = project.maps[selected],
    campaign = useMemo(() => projectContent(project), [project]);
  function change(next: any) {
    try {
      onChange(setProjectMap(project, selected, next));
      setError('');
    } catch (e: any) {
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
          {Object.entries(project.maps).map(([id, map]: any) => (
            <option key={id} value={id}>
              {map.metadata?.title ?? id} · {id}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {document ? (
        <>
          <SectorEditor
            key={selected}
            document={document}
            campaign={campaign}
            onDocumentChange={change}
            embedded
            templates={project.editor?.buildingTemplates ?? []}
            onSaveTemplate={(template: any) =>
              onChange(saveProjectBuildingTemplate(project, template))
            }
          />
          <details>
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
