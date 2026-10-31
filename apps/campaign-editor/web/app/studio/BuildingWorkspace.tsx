'use client';
import { editorErrorMessage } from '../../../infrastructure/editor-error-message.ts';
import { useState } from 'react';
import type { CampaignProjectDocument } from '../../../domain/campaign-project.ts';
import type { SectorMapCommand } from '../../../domain/sector-map-command.ts';
import type { PhysicalMap, JsonValue } from '../../../../../packages/campaign-format/types.ts';
import type { BattleSnapshot } from '../../../../../packages/game/public/campaign-editor-api.ts';
import {
  assertPhysicalMap,
  assertCampaignContent,
  readBuildingTemplate,
  documentObjects,
  documentObject,
  documentString,
  requireJsonDocument,
} from '../../lib/editor-documents.ts';

type BuildingPreview = {
  source: CampaignProjectDocument;
  mapId: string;
  battle: BattleSnapshot;
  expanded: boolean;
};

function readBuildingDocuments(project: CampaignProjectDocument, id: string) {
  try {
    const document = project.maps[id];
    if (!document) {
      return { error: 'Creá un mapa para empezar.' };
    }
    assertPhysicalMap(document);
    const campaign = projectContent(project);
    assertCampaignContent(campaign);
    const rawTemplates = project.editor?.['buildingTemplates'];
    if (rawTemplates !== undefined && !Array.isArray(rawTemplates)) {
      throw new Error('La biblioteca de plantillas necesita una lista.');
    }
    const templates = (rawTemplates ?? []).map(readBuildingTemplate);
    return { document, campaign, templates };
  } catch (error) {
    return { error: editorErrorMessage(error) };
  }
}
import { Battlefield } from '../../../../web/game-preview.ts';
import SectorEditor from '../editor/SectorEditor.tsx';
import FieldEditor, { DocumentEditor } from './FieldEditor';
import { projectContent } from '../../../infrastructure/project-operations.js';
import {
  setProjectMap,
  saveProjectBuildingTemplate,
  setProjectBuildingSlab,
} from '../../../infrastructure/world-editing.js';
import { buildingTemplate, editSectorMapDocument } from '../../../public/map-editing-api.js';
import { createMapPlaytest } from '../../../../../packages/game/public/campaign-editor-api.ts';
export default function BuildingWorkspace({
  project,
  onChange,
}: {
  project: CampaignProjectDocument;
  onChange: (next: CampaignProjectDocument) => void;
}) {
  const [mapId, setMapId] = useState(Object.keys(project.maps)[0] ?? ''),
    [buildingId, setBuildingId] = useState(''),
    [storedPreview, setStoredPreview] = useState<BuildingPreview | null>(null),
    [error, setError] = useState(''),
    [advanced, setAdvanced] = useState(false),
    [elevation, setElevation] = useState(3),
    [thickness, setThickness] = useState(0.28);
  const id = project.maps[mapId] ? mapId : (Object.keys(project.maps)[0] ?? '');
  const documents = readBuildingDocuments(project, id);
  if ('error' in documents) {
    return (
      <section className="studio-body">
        <h2>Edificios y vista 3D</h2>
        <p role="alert">{documents.error}</p>
        <p>Corregí los documentos para abrir el constructor.</p>
        <DocumentEditor
          value={project.maps}
          path="maps"
          onChange={(value) => {
            const maps = requireJsonDocument(value);
            const entries = Object.entries(maps).map(
              ([key, map]) => [key, requireJsonDocument(map)] as const,
            );
            onChange({ ...project, maps: Object.fromEntries(entries) });
          }}
        />
      </section>
    );
  }
  const { document, campaign, templates } = documents;
  const building =
    document.buildings.find((entry) => entry.id === buildingId) ?? document.buildings[0];
  const currentPreview =
    storedPreview?.source === project && storedPreview.mapId === id ? storedPreview : null;
  const battle = currentPreview?.battle;
  function change(next: PhysicalMap) {
    try {
      onChange(setProjectMap(project, id, next));
      setError('');
    } catch (error) {
      setError(editorErrorMessage(error));
    }
  }
  function changeRaw(value: JsonValue) {
    try {
      assertPhysicalMap(value);
      change(value);
    } catch (error) {
      setError(editorErrorMessage(error));
    }
  }
  function command(commands: SectorMapCommand[]) {
    const result = editSectorMapDocument(document, commands);
    if (result.errors.length) {
      setError(result.errors.join(' '));
    } else {
      change(result.document);
    }
  }
  function slab(geometry: { elevation: number; slabThickness: number } | null) {
    if (!building) {
      return;
    }
    try {
      onChange(setProjectBuildingSlab(project, id, building.id, geometry));
      setError('');
    } catch (error) {
      setError(editorErrorMessage(error));
    }
  }
  function preview(expanded: boolean) {
    try {
      setStoredPreview({
        source: project,
        mapId: id,
        battle: createMapPlaytest(document, campaign, { expanded }),
        expanded,
      });
      setError('');
    } catch (error) {
      setError(editorErrorMessage(error));
    }
  }
  const explicitFinishes =
    building &&
    (['wallFinish', 'roofFinish', 'doorStyle', 'windowStyle'] as const).filter(
      (key) => building[key] !== undefined,
    );
  return (
    <section className="studio-body">
      <h2>Edificios y vista 3D</h2>
      <p>
        Definí el estilo de campaña, elegí un edificio y revisá el resultado en 3D. El constructor
        permite editar paredes, aberturas, habitaciones, muebles y niveles.
      </p>
      <details>
        <summary>Estilos de construcción de la campaña</summary>
        <p className="editor-help">
          Los tipos del mundo aportan colores, altura y detalles. Cada edificio puede fijar su techo
          y sus acabados. Un acabado explícito tiene prioridad sobre el estilo de campaña.
        </p>
        <FieldEditor
          value={project.world['buildings'] ?? null}
          label="Tipos y dimensiones de construcción"
          path="world.buildings"
          onChange={(value) => {
            onChange({ ...project, world: { ...project.world, buildings: value } });
            setStoredPreview(null);
          }}
        />
      </details>
      <div className="studio-row">
        <label>
          Mapa
          <select
            value={id ?? ''}
            disabled={!id}
            onChange={(e) => {
              setMapId(e.target.value);
              setBuildingId('');
              setStoredPreview(null);
              setError('');
            }}
          >
            {Object.entries(project.maps).map(([id, map]) => (
              <option key={id} value={id}>
                {documentString(documentObject(map['metadata'])['title'], id)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Edificio
          <select
            value={building?.id ?? ''}
            disabled={!building}
            onChange={(e) => setBuildingId(e.target.value)}
          >
            {!building && <option value="">Sin edificios</option>}
            {document.buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name ?? b.id}
              </option>
            ))}
          </select>
        </label>
        <button disabled={!document} onClick={() => preview(false)}>
          Vista 3D del plano
        </button>
        <button disabled={!document} onClick={() => preview(true)}>
          Vista 3D de escena expandida
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="studio-building-preview-guide">
        <h3>Qué muestra cada vista</h3>
        <p className="editor-help">
          <strong>Plano:</strong> los edificios y objetos que colocaste en el mapa.{' '}
          <strong>Escena expandida:</strong> el plano dentro del entorno generado para esa
          localidad. Ambas vistas usan los estilos y suministros físicos del proyecto.
        </p>
        {document && (
          <p className="editor-help">
            {document.metadata.title} · {document.width} × {document.height} casillas ·{' '}
            {document.buildings.length} {document.buildings.length === 1 ? 'edificio' : 'edificios'}{' '}
            en el plano. Las acciones de prueba no cambian los documentos.
          </p>
        )}
      </div>
      {!building && (
        <div className="studio-building-empty">
          <h3>{document ? 'Este plano no tiene edificios' : 'Creá un mapa para empezar'}</h3>
          <p className="editor-help">
            {document
              ? 'Abrí el constructor y usá Dibujar edificio para crear el primero, o colocá una Casa colonial desde el catálogo. Después podés ajustar sus aberturas, niveles y acabados, o guardarlo como plantilla.'
              : 'El panel Mapas permite crear un plano. Al volver, podrás construir y revisar sus edificios.'}
          </p>
        </div>
      )}
      {building && (
        <section className="studio-building-selection">
          <h3>{building.name ?? building.id}</h3>
          <p className="editor-help">
            {building.width} × {building.height} casillas ·{' '}
            {building.architecture
              ? `Tipo de campaña: ${building.architecture}`
              : 'Tipo definido en el plano'}{' '}
            ·{' '}
            {explicitFinishes?.length
              ? `${explicitFinishes.length} acabados explícitos`
              : 'Sin acabados explícitos'}
            . Heredar acabados conserva el techo, la geometría y los niveles.
          </p>
          <div className="studio-row">
            <button
              onClick={() =>
                onChange(
                  saveProjectBuildingTemplate(project, buildingTemplate(document, building.id)),
                )
              }
            >
              Guardar edificio como plantilla
            </button>
            <button
              onClick={() =>
                command([
                  {
                    type: 'setObject',
                    id: building.id,
                    values: {
                      wallFinish: null,
                      roofFinish: null,
                      doorStyle: null,
                      windowStyle: null,
                    },
                  },
                ])
              }
            >
              Heredar acabados de campaña
            </button>
          </div>
          <h3>Losa y acceso</h3>
          <p className="editor-help">
            Esta operación crea una terraza sobre el edificio y un acceso desde una casilla libre.
            Revisá la altura en 3D antes de usar la plantilla.
          </p>
          <div className="studio-row">
            <label>
              Altura de losa (m)
              <input
                type="number"
                min={0.1}
                max={100}
                step={0.1}
                value={elevation}
                onChange={(e) => setElevation(e.target.valueAsNumber)}
              />
            </label>
            <label>
              Espesor de losa (m)
              <input
                type="number"
                min={0.01}
                max={10}
                step={0.01}
                value={thickness}
                onChange={(e) => setThickness(e.target.valueAsNumber)}
              />
            </label>
            <button onClick={() => slab({ elevation, slabThickness: thickness })}>
              Crear o reemplazar losa con acceso
            </button>
            <button onClick={() => slab(null)}>Quitar losa y accesos</button>
          </div>
        </section>
      )}
      <button
        className="editor-action-primary"
        disabled={!document}
        aria-expanded={advanced}
        onClick={() => setAdvanced(!advanced)}
      >
        {advanced ? 'Cerrar' : 'Abrir'} constructor de edificios
      </button>
      {advanced && document && (
        <SectorEditor
          key={id}
          document={document}
          campaign={campaign}
          onDocumentChange={change}
          embedded
          templates={templates}
          onSaveTemplate={(t) => onChange(saveProjectBuildingTemplate(project, t))}
        />
      )}
      <details>
        <summary>Biblioteca de plantillas ({templates.length})</summary>
        <p className="editor-help">
          Las plantillas incluyen paredes, aberturas, habitaciones, muebles y niveles. Se guardan
          con el proyecto; no agregan código a la campaña.
        </p>
        {!templates.length && (
          <p className="editor-help">
            La biblioteca está vacía. Elegí un edificio y usá Guardar edificio como plantilla para
            reutilizarlo en otros mapas.
          </p>
        )}
        {templates.map((t, index) => (
          <div className="studio-row" key={index}>
            <span>{t.name}</span>
            <button
              disabled={!document}
              onClick={() =>
                command([
                  {
                    type: 'stampTemplate',
                    id: `template-${crypto.randomUUID()}`,
                    x: 2,
                    y: 2,
                    template: t,
                  },
                ])
              }
            >
              Colocar en mapa
            </button>
            <button
              className="editor-action-danger"
              onClick={() =>
                onChange({
                  ...project,
                  editor: {
                    ...project.editor,
                    buildingTemplates: templates.filter((_, i) => i !== index),
                  },
                })
              }
            >
              Eliminar plantilla
            </button>
          </div>
        ))}
      </details>
      {battle && currentPreview && (
        <div className="studio-preview">
          <h3>
            {currentPreview.expanded ? 'Escena expandida' : 'Plano'} · {document.metadata.title}
          </h3>
          <p className="editor-help">
            {battle.width} × {battle.height} casillas · {battle.buildings?.length ?? 0} edificios.
            Esta prueba usa el mapa y los recursos del proyecto. Las acciones de la prueba no
            cambian los documentos.
          </p>
          <button onClick={() => setStoredPreview(null)}>Cerrar vista 3D</button>
          <Battlefield
            battle={battle}
            campaignContext={campaign}
            onChange={(next) => {
              setStoredPreview((current) => (current ? { ...current, battle: next } : null));
              return next;
            }}
            onFinish={() => setStoredPreview(null)}
            onMap={() => setStoredPreview(null)}
          />
        </div>
      )}
      {document && (
        <details>
          <summary>Losas, alturas y accesos</summary>
          <p>
            Las alturas y espesores se expresan en metros. Cada losa necesita una casilla de apoyo y
            cada acceso debe conectar niveles consecutivos. La prueba usa la misma validación del
            juego.
          </p>
          <DocumentEditor
            value={{
              upperSurfaces: document.upperSurfaces ?? [],
              climbLinks: document.climbLinks ?? [],
            }}
            path={`maps.${id}.levels`}
            onChange={(value) =>
              changeRaw({
                ...document,
                ...requireJsonDocument(value),
                revision: document.revision + 1,
              })
            }
          />
          <FieldEditor
            value={document.terrain.filter((t) => t.elevation !== undefined)}
            label="Terreno con altura"
            path={`maps.${id}.terrain.elevation`}
            onChange={(value) =>
              changeRaw({
                ...document,
                terrain: document.terrain.map(
                  (t) =>
                    documentObjects(value).find((v) => v['x'] === t.x && v['y'] === t.y) ??
                    Object.fromEntries(Object.entries(t).filter(([key]) => key !== 'elevation')),
                ),
                revision: document.revision + 1,
              })
            }
          />
        </details>
      )}
    </section>
  );
}
