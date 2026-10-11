'use client';
import { useEffect, useId, useState } from 'react';
import {
  DocumentDraftProvider,
  documentDraftKey,
  useDocumentDraftStore,
} from './DocumentDrafts';

export const FIELD_LABELS: Record<string, string> = {
  id: 'Identidad',
  name: 'Nombre',
  title: 'Título',
  version: 'Versión del formato',
  revision: 'Revisión',
  format: 'Formato',
  scenario: 'Reglas de escenario',
  content: 'Contenido',
  world: 'Mundo',
  presentation: 'Presentación',
  assets: 'Recursos',
  maps: 'Mapas',
  characters: 'Personajes',
  weapons: 'Armas',
  placements: 'Ubicaciones',
  quests: 'Misiones',
  errands: 'Encargos',
  rules: 'Reglas',
  campaignStory: 'Historia',
  campaignEvents: 'Eventos programados',
  roadsideDiscoveries: 'Hallazgos',
  introduction: 'Introducción',
  subtitle: 'Subtítulo',
  caption: 'Descripción',
  footer: 'Pie',
  eyebrow: 'Antetítulo',
  menuArt: 'Imagen de inicio',
  menuArtAlt: 'Descripción de la imagen',
  calendar: 'Calendario',
  characterPortraits: 'Catálogo de retratos',
  officerCreation: 'Creación de personajes',
  manual: 'Manual',
  atlas: 'Atlas',
  year: 'Año',
  month: 'Mes',
  day: 'Día',
  scenes: 'Escenas',
  text: 'Texto',
  visual: 'Presentación visual',
  durationMs: 'Duración (ms)',
  portrait: 'Retrato',
  src: 'Imagen',
  gender: 'Género',
  role: 'Función',
  skinTone: 'Tono de piel',
  spriteAppearance: 'Apariencia táctica',
  spriteSkinTone: 'Piel táctica',
  selectable: 'Disponible para elegir',
  biography: 'Biografía',
  personality: 'Personalidad',
  nickname: 'Apodo',
  attributes: 'Atributos',
  speech: 'Frases',
  conditions: 'Condiciones',
  effects: 'Efectos',
  status: 'Estado',
  type: 'Tipo',
  amount: 'Cantidad',
  min: 'Mínimo',
  max: 'Máximo',
  chapters: 'Capítulos',
  objective: 'Objetivo',
  victory: 'Victoria',
  defeat: 'Derrota',
  failureConditions: 'Condiciones de derrota',
  atHour: 'Hora del evento',
  operation: 'Operación',
  quest: 'Misión',
  requiredAlive: 'Personajes necesarios',
  deadlineHours: 'Plazo (horas)',
  sectors: 'Localidades',
  cells: 'Casillas',
  theaters: 'Regiones',
  factions: 'Facciones',
  cities: 'Ciudades',
  districts: 'Distritos',
  geography: 'Geografía',
  projection: 'Proyección',
  places: 'Rótulos de localidades',
  buildings: 'Construcciones',
  physical: 'Recursos físicos',
  expansion: 'Generación de escenas',
  weather: 'Clima',
  enemyStrategy: 'Estrategia adversaria',
  headquarters: 'Cuartel general',
  defaultHeadquarters: 'Cuartel general inicial',
  foundry: 'Taller',
  defaultFoundry: 'Taller inicial',
  campaignRoles: 'Funciones de campaña',
  defaultRoles: 'Funciones iniciales',
  incomeSources: 'Ingresos',
  sectorCash: 'Dinero en sectores',
  arrivalFacilities: 'Instalaciones de llegada',
  arrivalSites: 'Lugares de llegada',
  ruralSectors: 'Localidades rurales',
  path: 'Ruta del archivo',
  sha256: 'SHA-256',
  label: 'Etiqueta',
  enabled: 'Activado',
  width: 'Ancho',
  height: 'Altura',
  roof: 'Techo',
  wall: 'Pared',
  trim: 'Molduras',
  types: 'Tipos',
  footprints: 'Dimensiones',
  wallFinish: 'Acabado de pared',
  roofFinish: 'Acabado de techo',
  doorStyle: 'Estilo de puerta',
  windowStyle: 'Estilo de ventana',
  land: 'Tierra',
  rivers: 'Ríos',
  neighbors: 'Localidades conectadas',
  income: 'Ingreso',
  biome: 'Bioma',
  theater: 'Región',
  caches: 'Depósitos',
  arsenals: 'Artillería almacenada',
  environment: 'Puertas y contenedores',
  classes: 'Clases',
  questions: 'Preguntas',
  choices: 'Opciones',
  defaults: 'Valores iniciales',
  equipment: 'Equipo',
  traits: 'Rasgos',
  commissionQuestions: 'Preguntas de formación',
  commission: 'Incorporación',
  registry: 'Registro',
  classId: 'Clase inicial',
  portraitId: 'Retrato inicial',
  doctrineWeapons: 'Armas por doctrina',
  questionError: 'Mensaje de preguntas incompletas',
  availableText: 'Mensaje de disponibilidad',
  statusText: 'Mensaje de incorporación',
  weapon: 'Arma principal',
  blade: 'Arma corta',
  templates: 'Plantillas',
  buildingsTemplates: 'Plantillas de edificios',
  longitudes: 'Longitudes',
  latitudes: 'Latitudes',
  longitudeScale: 'Escala de longitud',
  latitudeScale: 'Escala de latitud',
  minLongitude: 'Longitud inicial',
  maxLatitude: 'Latitud superior',
  startingTerritory: 'Territorio inicial',
  startingTreasury: 'Tesorería inicial',
  owner: 'Control',
  loyalty: 'Lealtad',
  requiredSectors: 'Sectores necesarios',
  requires: 'Requisitos',
  reward: 'Recompensa',
  cost: 'Costo',
  imports: 'Importaciones',
  artillerySupply: 'Suministro de artillería',
  artilleryTrading: 'Comercio de artillería',
  ammunitionMarket: 'Munición',
  oppositionAppearance: 'Apariencia adversaria',
  militiaAppearance: 'Apariencia de milicias',
};
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const enumerated: Record<string, string[]> = {
  visual: ['map', 'letter', 'route', 'muster'],
  gender: ['woman', 'man'],
  skinTone: ['light', 'brown', 'dark'],
  spriteSkinTone: ['light', 'brown', 'dark'],
};
const valueFor = (type: string) =>
  type === 'number'
    ? 0
    : type === 'boolean'
      ? false
      : type === 'object'
        ? {}
        : type === 'array'
          ? []
          : type === 'null'
            ? null
            : '';
export const fieldLabel = (key: string) =>
  FIELD_LABELS[key] ??
  key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
export type FieldEditorProps = {
  value: any;
  onChange: (next: any) => void;
  label?: string;
  path?: string;
  depth?: number;
};

const normalized = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
const FIELD_HELP: Record<string, string> = {
  id: 'Usá una identidad estable para mantener las referencias.',
  durationMs: 'Tiempo en milisegundos. 1000 ms equivalen a un segundo.',
  atHour: 'Hora transcurrida desde el inicio de la campaña.',
  deadlineHours: 'Plazo medido en horas de campaña.',
  portrait: 'Referencia al retrato del personaje.',
  path: 'Ruta relativa del archivo dentro del paquete.',
  sha256: 'El estudio calcula esta huella al incorporar el archivo.',
};

/** Retain partial typing without replacing a numeric field with null. */
function NumericField({
  value,
  onChange,
  label,
  path,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  path: string;
}) {
  const [raw, setRaw] = useState(String(value));
  const [error, setError] = useState('');
  const errorId = useId();
  useEffect(() => {
    setRaw((current) =>
      current.trim() && Number(current.replace(',', '.')) === value
        ? current
        : String(value),
    );
    setError('');
  }, [value]);
  return (
    <label className="studio-value-field" title={path}>
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={raw}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          const next = event.target.value;
          setRaw(next);
          setError('');
          const parsed = Number(next.replace(',', '.'));
          if (
            next.trim() &&
            !/[.,]$/.test(next) &&
            Number.isFinite(parsed) &&
            parsed !== value
          )
            onChange(parsed);
        }}
        onBlur={() => {
          const parsed = Number(raw.replace(',', '.'));
          if (!raw.trim() || !Number.isFinite(parsed)) {
            setRaw(String(value));
            setError(
              'Ingresá un número. Se conservó el último valor aplicado.',
            );
          } else {
            if (parsed !== value) onChange(parsed);
            setRaw(String(parsed));
          }
        }}
      />
      {error && (
        <small id={errorId} role="alert">
          {error}
        </small>
      )}
      {FIELD_HELP[path.split('.').at(-1) ?? ''] && (
        <small>{FIELD_HELP[path.split('.').at(-1) ?? '']}</small>
      )}
    </label>
  );
}

export default function FieldEditor({
  value,
  onChange,
  label = 'Campos',
  path = '',
  depth = 0,
}: FieldEditorProps) {
  const inputId = useId(),
    [open, setOpen] = useState(depth === 0),
    [newKey, setNewKey] = useState(''),
    [newType, setNewType] = useState('string'),
    [page, setPage] = useState(0),
    [query, setQuery] = useState('');
  const array = Array.isArray(value),
    object = value !== null && typeof value === 'object' && !array;
  if (array || object) {
    const entries = array
      ? value.map(
          (entry: any, index: number) => [String(index), entry] as const,
        )
      : Object.entries(value);
    const filtered = entries.filter(
      ([key, entry]) =>
        !query ||
        normalized(
          `${key} ${fieldLabel(key)} ${entry?.id ?? ''} ${entry?.name ?? ''} ${entry?.title ?? ''}`,
        ).includes(normalized(query)),
    );
    const pages = Math.max(1, Math.ceil(filtered.length / 20)),
      current = Math.min(page, pages - 1),
      shown = filtered.slice(current * 20, current * 20 + 20);
    const patch = (key: string, next: any) =>
      onChange(
        array
          ? value.map((entry: any, index: number) =>
              String(index) === key ? next : entry,
            )
          : { ...value, [key]: next },
      );
    const remove = (key: string) => {
      if (array)
        onChange(
          value.filter((_: any, index: number) => String(index) !== key),
        );
      else {
        const next = { ...value };
        delete next[key];
        onChange(next);
      }
    };
    function add() {
      setQuery('');
      if (array) {
        onChange([...value, valueFor(newType)]);
        setPage(Math.floor(value.length / 20));
        return;
      }
      const key = newKey.trim();
      if (!key || forbidden.has(key) || Object.hasOwn(value, key)) return;
      onChange({ ...value, [key]: valueFor(newType) });
      setNewKey('');
      setPage(Math.floor(entries.length / 20));
    }
    return (
      <section
        className={`studio-fields studio-fields-depth-${Math.min(depth, 3)}`}
        aria-label={label}
      >
        <button
          type="button"
          className="studio-field-heading"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span>
            {open ? '▾' : '▸'} {label}
          </span>
          <small>
            {entries.length} {array ? 'elementos' : 'campos'}
          </small>
        </button>
        {open && (
          <div className="studio-field-body">
            {(entries.length > 5 || query) && (
              <div className="studio-field-tools">
                <label>
                  Buscar elementos
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(0);
                    }}
                  />
                </label>
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setPage(0);
                    }}
                  >
                    Limpiar búsqueda
                  </button>
                )}
                <button
                  type="button"
                  disabled={current === 0}
                  onClick={() => setPage(current - 1)}
                >
                  Anterior
                </button>
                <span>
                  {current + 1} / {pages}
                </span>
                <button
                  type="button"
                  disabled={current >= pages - 1}
                  onClick={() => setPage(current + 1)}
                >
                  Siguiente
                </button>
              </div>
            )}
            {shown.map(([key, entry]) => (
              <div className="studio-field-row" key={key}>
                <FieldEditor
                  value={entry}
                  onChange={(next) => patch(key, next)}
                  label={
                    array
                      ? `${Number(key) + 1}. ${entry?.name ?? entry?.title ?? entry?.id ?? 'Elemento'}`
                      : fieldLabel(key)
                  }
                  path={path ? `${path}.${key}` : key}
                  depth={depth + 1}
                />
                <div className="studio-field-row-actions">
                  {array && (
                    <>
                      <button
                        type="button"
                        title="Mover hacia arriba"
                        aria-label={`Subir ${key}`}
                        disabled={key === '0'}
                        onClick={() => {
                          const next = [...value],
                            index = Number(key);
                          [next[index - 1], next[index]] = [
                            next[index],
                            next[index - 1],
                          ];
                          onChange(next);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        title="Mover hacia abajo"
                        aria-label={`Bajar ${key}`}
                        disabled={Number(key) === value.length - 1}
                        onClick={() => {
                          const next = [...value],
                            index = Number(key);
                          [next[index], next[index + 1]] = [
                            next[index + 1],
                            next[index],
                          ];
                          onChange(next);
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        title="Duplicar elemento"
                        onClick={() =>
                          onChange([
                            ...value.slice(0, Number(key) + 1),
                            structuredClone(entry),
                            ...value.slice(Number(key) + 1),
                          ])
                        }
                      >
                        Duplicar
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="studio-text-danger"
                    aria-label={`Quitar ${array ? 'elemento ' + (Number(key) + 1) : fieldLabel(key)}`}
                    onClick={() => remove(key)}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
            {!entries.length && (
              <p className="studio-muted">
                Todavía no hay {array ? 'elementos' : 'campos'}. Agregá el
                primero.
              </p>
            )}
            {entries.length > 0 && !filtered.length && (
              <p className="studio-muted" role="status">
                No hay resultados para “{query}”. Cambiá la búsqueda o limpiá el
                filtro.
              </p>
            )}
            <div className="studio-add-field">
              {!array && (
                <label>
                  Campo nuevo
                  <input
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="Nombre del campo"
                    list={`${inputId}-keys`}
                  />
                  <datalist id={`${inputId}-keys`}>
                    {Object.keys(FIELD_LABELS)
                      .filter((key) => !Object.hasOwn(value, key))
                      .map((key) => (
                        <option value={key} key={key}>
                          {fieldLabel(key)}
                        </option>
                      ))}
                  </datalist>
                </label>
              )}
              <label>
                Tipo
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                >
                  <option value="string">Texto</option>
                  <option value="number">Número</option>
                  <option value="boolean">Sí / no</option>
                  <option value="object">Grupo de campos</option>
                  <option value="array">Lista</option>
                  <option value="null">Sin valor</option>
                </select>
              </label>
              <button
                type="button"
                disabled={
                  !array &&
                  (!newKey.trim() ||
                    forbidden.has(newKey.trim()) ||
                    Object.hasOwn(value, newKey.trim()))
                }
                onClick={add}
              >
                Agregar {array ? 'elemento' : 'campo'}
              </button>
            </div>
          </div>
        )}
      </section>
    );
  }
  if (typeof value === 'boolean')
    return (
      <label className="studio-check-field" title={path}>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{label}</span>
      </label>
    );
  if (typeof value === 'number')
    return (
      <NumericField
        value={value}
        onChange={onChange}
        label={label}
        path={path}
      />
    );
  if (value === null || value === undefined)
    return (
      <div className="studio-null-field">
        <span>{label}</span>
        <small>Sin valor</small>
        <select
          aria-label={`Tipo de ${label}`}
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
        >
          <option value="string">Texto</option>
          <option value="number">Número</option>
          <option value="boolean">Sí / no</option>
          <option value="object">Grupo de campos</option>
          <option value="array">Lista</option>
        </select>
        <button type="button" onClick={() => onChange(valueFor(newType))}>
          Definir
        </button>
      </div>
    );
  const choices = enumerated[path.split('.').at(-1) ?? ''];
  return (
    <label className="studio-value-field" title={path}>
      {label}
      {typeof value === 'string' && choices ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {!choices.includes(value) && (
            <option value={value}>{value || 'Elegir valor'}</option>
          )}
          {choices.map((choice) => (
            <option key={choice}>{choice}</option>
          ))}
        </select>
      ) : typeof value === 'string' && /^#[a-f\d]{6}$/i.test(value) ? (
        <span className="studio-colour-field">
          <input
            aria-label={`Color de ${label}`}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <input value={value} onChange={(e) => onChange(e.target.value)} />
        </span>
      ) : typeof value === 'string' &&
        (value.length > 100 ||
          /text|description|biography|introduction|objective|victory|defeat|caption|personality|note/i.test(
            path,
          )) ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {FIELD_HELP[path.split('.').at(-1) ?? ''] && (
        <small>{FIELD_HELP[path.split('.').at(-1) ?? '']}</small>
      )}
    </label>
  );
}

export function DocumentEditor(props: FieldEditorProps) {
  const store = useDocumentDraftStore();
  return store ? (
    <StagedDocumentEditor {...props} />
  ) : (
    <DocumentDraftProvider scope="document-editor">
      <StagedDocumentEditor {...props} />
    </DocumentDraftProvider>
  );
}

function StagedDocumentEditor(props: FieldEditorProps) {
  const store = useDocumentDraftStore()!;
  const key = documentDraftKey(
    store.scope,
    props.path ?? props.label ?? 'document',
  );
  const applied = JSON.stringify(props.value, null, 2);
  const staged = store.drafts[key];
  const text = staged?.text ?? applied;
  const [mode, setMode] = useState(staged ? 'json' : 'fields');
  const [error, setError] = useState('');
  const [replace, setReplace] = useState(false);
  const [pending, setPending] = useState<{ key: string; text: string } | null>(
    null,
  );
  const conflict = Boolean(staged && staged.base !== applied);
  useEffect(() => {
    setReplace(false);
  }, [applied]);
  useEffect(() => {
    setReplace(false);
    setError('');
    setPending(null);
  }, [key]);
  const discard = () =>
    store.setDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  useEffect(() => {
    if (pending?.key === key && pending.text === applied) {
      store.setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setPending(null);
      setReplace(false);
    }
  }, [pending, applied, key, store.setDrafts]);
  return (
    <section className="studio-document">
      <div className="studio-document-mode">
        <button
          type="button"
          aria-pressed={mode === 'fields'}
          onClick={() => setMode('fields')}
        >
          Campos
        </button>
        <button
          type="button"
          aria-pressed={mode === 'json'}
          onClick={() => {
            setMode('json');
            setError('');
          }}
        >
          JSON
        </button>
        <span
          className="editor-status"
          data-state={staged ? 'pending' : 'saved'}
        >
          {staged ? 'Texto sin aplicar' : 'Datos aplicados'}
        </span>
      </div>
      {staged && (
        <p className="editor-help">
          Este texto se conserva al cambiar de panel. El guardado y las
          descargas usan los datos aplicados. Aplicalo o descartalo antes de
          cerrar la página.
        </p>
      )}
      {mode === 'fields' ? (
        <FieldEditor {...props} />
      ) : (
        <>
          <label>
            Documento JSON
            <textarea
              className="studio-json"
              rows={22}
              spellCheck={false}
              value={text}
              onChange={(event) => {
                const nextText = event.target.value;
                setError('');
                setPending(null);
                setReplace(false);
                store.setDrafts((current) => {
                  const next = { ...current };
                  if (nextText === applied) delete next[key];
                  else
                    next[key] = {
                      text: nextText,
                      base: current[key]?.base ?? applied,
                    };
                  return next;
                });
              }}
            />
          </label>
          {conflict && (
            <div className="studio-document-conflict" role="alert">
              <p>
                Los datos aplicados cambiaron mientras editabas este texto.
                Revisá ambas versiones antes de reemplazarlos.
              </p>
              <label className="studio-check-field">
                <input
                  type="checkbox"
                  checked={replace}
                  onChange={(event) => setReplace(event.target.checked)}
                />
                Reemplazar los datos actuales con este texto
              </label>
            </div>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="studio-row">
            <button
              type="button"
              className="editor-action-primary"
              disabled={!staged || (conflict && !replace)}
              onClick={() => {
                try {
                  const next = JSON.parse(text);
                  setPending({ key, text: JSON.stringify(next, null, 2) });
                  props.onChange(next);
                  setError('');
                } catch (error: any) {
                  setError(`No se pudo aplicar el documento: ${error.message}`);
                }
              }}
            >
              Aplicar documento
            </button>
            <button
              type="button"
              disabled={!staged}
              onClick={() => {
                discard();
                setError('');
                setPending(null);
                setReplace(false);
              }}
            >
              Descartar texto
            </button>
          </div>
        </>
      )}
    </section>
  );
}
