'use client';
import type { CampaignProjectDocument, JsonDocument } from '../../../domain/campaign-project.ts';
import {
  documentObjects,
  documentObject,
  documentString,
  documentNumber,
  requireJsonDocument,
  assertCampaignContent,
} from '../../lib/editor-documents.ts';
import FieldEditor, { DocumentEditor } from './FieldEditor';
import { useStudioAssetResolver } from '../../lib/campaign-studio-assets.ts';
import { NEUTRAL_OFFICER_CREATION } from '../../../../../packages/game/public/campaign-editor-api.ts';
import { operativeIdForCharacter } from '../../../../../packages/game/public/campaign-editor-api.ts';
import { projectContent } from '../../../infrastructure/project-operations.js';

export default function PresentationWorkspace({
  project,
  onChange,
}: {
  project: CampaignProjectDocument;
  onChange: (next: CampaignProjectDocument) => void;
}) {
  const presentation = project.presentation,
    resolveAsset = useStudioAssetResolver(project);
  const update = (patch: JsonDocument) => {
    const next = { ...presentation, ...patch };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === undefined) {
        delete next[key];
      }
    }
    onChange({ ...project, presentation: next });
  };
  const imageChoices = documentObjects(project.assets['assets']).filter((entry) =>
    documentString(entry['type']).startsWith('image/'),
  );
  const portraits = documentObjects(presentation['characterPortraits']);
  const characters = documentObjects(project.content['characters']);
  const sectors = documentObjects(project.world['sectors']);
  const calendar = documentObject(presentation['calendar']);
  function sample() {
    const person = characters[0],
      mapId = Object.keys(project.maps)[0],
      sector = sectors.find((sector) => sector['id'] === mapId) ?? sectors[0];
    if (!person || !mapId) {
      return;
    }
    const content = projectContent(project);
    assertCampaignContent(content);
    const operativeId = operativeIdForCharacter(content, documentString(person['id']));
    if (operativeId === undefined) {
      throw new Error('El personaje de muestra no tiene una identidad publicada.');
    }
    update({
      skirmish: {
        label: 'Combate de muestra',
        operativeIds: [operativeId],
        horse: false,
        request: {
          id: mapId,
          name: documentString(documentObject(project.maps[mapId]?.['metadata'])['title'], mapId),
          biome: documentString(sector?.['biome'], 'plains'),
          seed: 1812,
          enemyCount: 2,
        },
      },
    });
  }
  return (
    <div className="studio-workspace">
      <div className="studio-section-heading">
        <div>
          <p className="studio-kicker">Identidad visual</p>
          <h2>Presentación de la campaña</h2>
          <p>El menú, la introducción y las opciones de creación pertenecen a esta campaña.</p>
        </div>
      </div>
      <div className="studio-two-column">
        <section className="studio-card">
          <h3>Menú de inicio</h3>
          <div className="studio-form-grid">
            {(
              ['title', 'subtitle', 'eyebrow', 'period', 'caption', 'footer', 'menuArtAlt'] as const
            ).map((key) => (
              <FieldEditor
                key={key}
                value={presentation[key] ?? ''}
                label={
                  {
                    title: 'Título',
                    subtitle: 'Subtítulo',
                    eyebrow: 'Antetítulo',
                    period: 'Época',
                    caption: 'Descripción',
                    footer: 'Pie',
                    menuArtAlt: 'Descripción de la imagen',
                  }[key]
                }
                path={`presentation.${key}`}
                onChange={(value) => {
                  const next = { ...presentation };
                  if (value === '') {
                    delete next[key];
                  } else {
                    next[key] = value;
                  }
                  onChange({ ...project, presentation: next });
                }}
              />
            ))}
          </div>
          <label>
            Imagen del menú
            <select
              value={documentString(presentation['menuArt'])}
              onChange={(e) => {
                const next = { ...presentation };
                if (e.target.value) {
                  next['menuArt'] = e.target.value;
                } else {
                  delete next['menuArt'];
                }
                onChange({ ...project, presentation: next });
              }}
            >
              <option value="">Sin imagen</option>
              {imageChoices.map((entry) => (
                <option
                  key={documentString(entry['path'])}
                  value={`/campaigns/${project.manifest.id}/${documentString(entry['path'])}`}
                >
                  {documentString(entry['id'])} · {documentString(entry['path'])}
                </option>
              ))}
            </select>
          </label>
        </section>
        <section
          className="studio-menu-preview"
          aria-label="Vista previa del menú"
          style={
            presentation['menuArt']
              ? {
                  backgroundImage: `linear-gradient(180deg,#111b15aa,#111b15ee),url("${resolveAsset(documentString(presentation['menuArt']))}")`,
                }
              : undefined
          }
        >
          <p>{documentString(presentation['eyebrow'], 'CAMPAÑA TÁCTICA')}</p>
          <h3>{documentString(presentation['title'])}</h3>
          <p>{documentString(presentation['subtitle'])}</p>
          <span>{documentString(presentation['period'])}</span>
          <p>{documentString(presentation['caption'])}</p>
          <button type="button" disabled>
            Nueva campaña
          </button>
          <small>{documentString(presentation['footer'])}</small>
        </section>
      </div>
      <div className="studio-two-column">
        <section className="studio-card">
          <h3>Calendario</h3>
          <div className="studio-form-grid">
            {(['year', 'month', 'day'] as const).map((key) => (
              <label key={key}>
                {{ year: 'Año', month: 'Mes', day: 'Día' }[key]}
                <input
                  type="number"
                  min={1}
                  max={key === 'year' ? 10000 : key === 'month' ? 12 : 30}
                  value={documentNumber(calendar[key], 1)}
                  onChange={(e) =>
                    update({
                      calendar: {
                        year: 1,
                        month: 1,
                        day: 1,
                        ...calendar,
                        [key]: e.target.valueAsNumber,
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </section>
        <section className="studio-card">
          <h3>Manual del jugador</h3>
          <FieldEditor
            value={
              presentation['manual'] ?? {
                campaign: 'Comenzá la campaña.',
                goals: 'Completá sus objetivos.',
                note: 'Explorá el mundo.',
              }
            }
            onChange={(manual) => update({ manual })}
            label="Texto del manual"
            path="presentation.manual"
          />
        </section>
      </div>
      <section className="studio-card">
        <h3>Introducción</h3>
        <p>
          Creá escenas de mapa, carta, ruta o formación. Cada escena puede tener retrato, texto,
          sello y duración.
        </p>
        {!presentation['introduction'] && (
          <button
            type="button"
            onClick={() =>
              update({
                introduction: {
                  version: 1,
                  title: 'Introducción',
                  scenes: [
                    {
                      id: 'opening',
                      title: 'El comienzo',
                      text: 'Una nueva campaña comienza.',
                      visual: 'letter',
                      durationMs: 5000,
                    },
                  ],
                },
              })
            }
          >
            Crear introducción
          </button>
        )}
        <FieldEditor
          value={presentation['introduction'] ?? null}
          onChange={(introduction) => update({ introduction })}
          label="Escenas y carta"
          path="presentation.introduction"
        />
      </section>
      <section className="studio-card">
        <h3>Catálogo de retratos</h3>
        <p>
          Las imágenes se suben en Recursos. Cada retrato puede definir género, función, piel y
          apariencia táctica.
        </p>
        <button
          type="button"
          disabled={!imageChoices.length}
          onClick={() => {
            const image = imageChoices[0];
            if (!image) {
              return;
            }
            let n = 1;
            while (portraits.some((p) => p['id'] === `face-${n}`)) {
              n++;
            }
            update({
              characterPortraits: [
                ...portraits,
                {
                  id: `face-${n}`,
                  name: `Retrato ${n}`,
                  src: `/campaigns/${project.manifest.id}/${documentString(image['path'])}`,
                  gender: 'man',
                  role: 'scout',
                  skinTone: 'brown',
                  spriteSkinTone: 'brown',
                  spriteAppearance: 'surgeon',
                  selectable: true,
                },
              ],
            });
          }}
        >
          Agregar retrato
        </button>
        <FieldEditor
          value={presentation['characterPortraits'] ?? []}
          onChange={(characterPortraits) => update({ characterPortraits })}
          label="Retratos disponibles"
          path="presentation.characterPortraits"
        />
      </section>
      <section className="studio-card">
        <h3>Atlas y creación de personajes</h3>
        <p>
          Todos los campos admitidos por el motor están disponibles en estos grupos. Las clases y
          preguntas seleccionan las reglas compartidas.
        </p>
        <FieldEditor
          value={presentation['atlas'] ?? { title: 'Mapa de campaña', label: 'Territorio' }}
          onChange={(atlas) => update({ atlas })}
          label="Atlas"
          path="presentation.atlas"
        />
        {!presentation['officerCreation'] ? (
          <button
            onClick={() => update({ officerCreation: structuredClone(NEUTRAL_OFFICER_CREATION) })}
          >
            Crear opciones de personaje
          </button>
        ) : (
          <>
            <FieldEditor
              value={presentation['officerCreation']}
              onChange={(officerCreation) => update({ officerCreation })}
              label="Creación de personajes"
              path="presentation.officerCreation"
            />
            <button onClick={() => update({ officerCreation: null })}>
              Usar creación predeterminada
            </button>
          </>
        )}
        {!presentation['skirmish'] ? (
          <button disabled={!characters.length} onClick={sample}>
            Crear combate de muestra
          </button>
        ) : (
          <>
            <FieldEditor
              value={presentation['skirmish']}
              onChange={(skirmish) => update({ skirmish })}
              label="Combate de muestra"
              path="presentation.skirmish"
            />
            <button onClick={() => update({ skirmish: null })}>Quitar combate de muestra</button>
          </>
        )}
      </section>
      <details className="studio-card">
        <summary>Documento completo de presentación</summary>
        <DocumentEditor
          value={presentation}
          onChange={(value) => onChange({ ...project, presentation: requireJsonDocument(value) })}
          label="Todos los campos de presentación"
          path="presentation"
        />
      </details>
    </div>
  );
}
