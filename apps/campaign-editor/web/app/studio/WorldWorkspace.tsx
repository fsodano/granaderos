'use client';
import { editorErrorMessage } from '../../../infrastructure/editor-error-message.ts';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import FieldEditor, { DocumentEditor } from './FieldEditor';
import {
  addProjectLocality,
  moveProjectLocality,
  updateProjectLocality,
  updateProjectCell,
  setProjectDistrict,
  setProjectLocalityLink,
  deleteProjectLocality,
} from '../../../infrastructure/world-editing.js';
const biomes = [
  'plains',
  'wetland',
  'foothills',
  'forest',
  'scrub',
  'river',
  'urban',
  'mountain',
  'water',
];
const groups: Record<string, string[]> = {
  'Ciudades y regiones': ['cities', 'theaters', 'factions', 'projection', 'geography'],
  'Etiquetas y distritos': ['places', 'districts'],
  'Instalaciones, ingresos y suministros': [
    'arrivalFacilities',
    'incomeSources',
    'sectorCash',
    'workshopSectors',
    'defaultHeadquarters',
    'defaultFoundry',
    'defaultRoles',
    'physical',
    'merchantPolicies',
    'artilleryTrading',
  ],
  'Escenas, salidas y despliegue': [
    'exitLinks',
    'sceneExits',
    'sceneEntries',
    'sceneExitAnchors',
    'sceneLocations',
    'deployment',
    'defaultDeployment',
    'landscapes',
    'ruralSectors',
  ],
  'Viajes, clima e invasiones': ['travel', 'weather', 'enemyStrategy'],
  'Construcciones y generación': ['buildings', 'expansion'],
};
export default function WorldWorkspace({
  project,
  onChange,
}: {
  project: any;
  onChange: (next: any) => void;
}) {
  const [selected, setSelected] = useState(
      project.world.cells.find((c: any) => c.anchor)?.id ?? 'cell-0-0',
    ),
    [locality, setLocality] = useState(project.world.sectors[0]?.id ?? ''),
    [name, setName] = useState('Nueva localidad'),
    [id, setId] = useState('new-locality'),
    [error, setError] = useState('');
  const world = project.world,
    cell =
      world.cells.find((c: any) => c.id === selected) ??
      world.cells.find((c: any) => c.anchor) ??
      world.cells[0],
    sector = world.sectors.find((s: any) => s.id === locality) ?? world.sectors[0];
  const gridHelpId = useId(),
    gridContextId = useId(),
    cellButtons = useRef(new Map<string, HTMLButtonElement>());
  const rows = useMemo(
    () =>
      Array.from({ length: 33 }, (_, row) =>
        world.cells.filter((c: any) => c.row === row).sort((a: any, b: any) => a.col - b.col),
      ),
    [world.cells],
  );
  const cellsByPosition = useMemo(
    () => new Map<string, any>(world.cells.map((c: any) => [`${c.col},${c.row}`, c])),
    [world.cells],
  );
  const regionName = (theater: string) =>
    world.theaters.find((t: any) => t.id === theater)?.name ?? theater;
  const selectedLocality = world.sectors.find((s: any) => s.id === cell?.locality);
  const anchor = world.cells.find((c: any) => c.anchor && c.locality === sector?.id);
  function selectCell(next: any, focus = false) {
    if (!next) return;
    setSelected(next.id);
    if (next.locality) setLocality(next.locality);
    if (focus) {
      const button = cellButtons.current.get(next.id);
      button?.focus({ preventScroll: true });
      button?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
  }
  function navigateGrid(event: KeyboardEvent<HTMLButtonElement>, from: any) {
    if (event.altKey) return;
    let col = from.col,
      row = from.row;
    switch (event.key) {
      case 'ArrowLeft':
        col = Math.max(0, col - 1);
        break;
      case 'ArrowRight':
        col = Math.min(35, col + 1);
        break;
      case 'ArrowUp':
        row = Math.max(0, row - 1);
        break;
      case 'ArrowDown':
        row = Math.min(32, row + 1);
        break;
      case 'Home':
        col = 0;
        if (event.ctrlKey || event.metaKey) row = 0;
        break;
      case 'End':
        col = 35;
        if (event.ctrlKey || event.metaKey) row = 32;
        break;
      default:
        return;
    }
    event.preventDefault();
    selectCell(cellsByPosition.get(`${col},${row}`), true);
  }
  function chooseLocality(next: string) {
    setLocality(next);
    selectCell(world.cells.find((c: any) => c.anchor && c.locality === next));
  }
  function act(fn: () => any) {
    try {
      onChange(fn());
      setError('');
    } catch (e: any) {
      setError(editorErrorMessage(e));
    }
  }
  function worldField(key: string, value: any) {
    onChange({ ...project, world: { ...world, [key]: value } });
  }
  return (
    <section className="studio-body">
      <h2>Mundo estratégico</h2>
      <p>
        La cuadrícula tiene 36 × 33 casillas. Elegí una casilla para pintar el terreno, asignar un
        distrito o mover una cabecera.
      </p>
      {error && <p role="alert">{error}</p>}
      <p id={gridHelpId} className="editor-help">
        Usá las flechas para recorrer casillas. <kbd className="editor-shortcut">Inicio</kbd> y{' '}
        <kbd className="editor-shortcut">Fin</kbd> van a los extremos de la fila; con{' '}
        <kbd className="editor-shortcut">Ctrl / ⌘</kbd>, a los extremos del mapa. Tab sale de la
        cuadrícula.
      </p>
      <div className="studio-grid-legend" aria-label="Leyenda del mapa">
        <span data-cell-kind="anchor">◆ Cabecera</span>
        <span data-cell-kind="district">· Distrito</span>
        <span data-cell-kind="land">Tierra</span>
        <span data-cell-kind="water">Agua</span>
      </div>
      {cell && (
        <div id={gridContextId} className="studio-grid-context" role="status" aria-live="polite">
          <strong>
            Casilla {cell.grid} · {cell.name}
          </strong>
          <span>
            {cell.anchor ? 'Cabecera' : cell.district ? 'Distrito' : cell.land ? 'Tierra' : 'Agua'}{' '}
            · {regionName(cell.theater)}
            {selectedLocality ? ` · ${selectedLocality.name}` : ' · Sin localidad'}
          </span>
        </div>
      )}
      <div
        className="studio-grid-scroll"
        style={{ minWidth: 0, maxWidth: '100%', overflowX: 'auto' }}
      >
        <div
          className="studio-grid"
          role="grid"
          aria-label="Cuadrícula estratégica"
          aria-rowcount={33}
          aria-colcount={36}
          aria-describedby={`${gridHelpId} ${gridContextId}`}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(36,minmax(20px,1fr))',
            gap: 2,
            minWidth: 792,
            maxWidth: 1000,
          }}
        >
          {rows.map((row: any[], rowIndex: number) => (
            <div key={rowIndex} role="row" style={{ display: 'contents' }}>
              {row.map((c: any) => (
                <button
                  key={c.id}
                  ref={(button) => {
                    if (button) cellButtons.current.set(c.id, button);
                    else cellButtons.current.delete(c.id);
                  }}
                  className="studio-grid-cell"
                  type="button"
                  role="gridcell"
                  aria-rowindex={c.row + 1}
                  aria-colindex={c.col + 1}
                  tabIndex={c.id === cell?.id ? 0 : -1}
                  aria-selected={c.id === cell?.id}
                  aria-label={`${c.grid}: ${c.name}`}
                  title={`${c.grid} · ${c.name} · ${regionName(c.theater)}`}
                  data-cell-kind={
                    c.anchor ? 'anchor' : c.district ? 'district' : c.land ? 'land' : 'water'
                  }
                  style={{
                    padding: 0,
                    minHeight: 20,
                    minWidth: 20,
                    background: c.anchor
                      ? 'var(--editor-accent-soft)'
                      : c.district
                        ? '#315a58'
                        : c.land
                          ? 'var(--editor-surface)'
                          : 'var(--editor-bg)',
                    color: c.anchor ? 'var(--editor-accent)' : 'var(--editor-muted)',
                    outline: c.id === cell?.id ? '2px solid var(--editor-accent)' : undefined,
                    outlineOffset: -2,
                    fontSize: 10,
                    borderRadius: 2,
                  }}
                  onClick={() => selectCell(c)}
                  onKeyDown={(e) => navigateGrid(e, c)}
                >
                  {c.anchor ? '◆' : c.district ? '·' : ''}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      {cell && (
        <div className="studio-grid-tools studio-row">
          <h3>Casilla {cell.grid}</h3>
          <label>
            Nombre
            <input
              value={cell.name}
              onChange={(e) =>
                act(() => updateProjectCell(project, cell.id, { name: e.target.value }))
              }
            />
          </label>
          <label>
            Terreno
            <select
              value={cell.biome}
              onChange={(e) =>
                act(() => updateProjectCell(project, cell.id, { biome: e.target.value }))
              }
            >
              {biomes.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label>
            Región
            <select
              value={cell.theater}
              onChange={(e) =>
                act(() => updateProjectCell(project, cell.id, { theater: e.target.value }))
              }
            >
              {world.theaters.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Distrito
            <select
              value={cell.locality ?? ''}
              disabled={cell.anchor}
              onChange={(e) =>
                act(() => setProjectDistrict(project, cell.id, e.target.value || null))
              }
            >
              <option value="">Sin distrito</option>
              {world.sectors.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <details className="studio-locality-create">
        <summary>Crear una localidad</summary>
        <p className="editor-help">
          La nueva cabecera usará la casilla elegida. Necesita tierra libre y una identidad única.
        </p>
        <div className="studio-row">
          <label>
            Identidad de nueva localidad
            <input value={id} onChange={(e) => setId(e.target.value)} />
          </label>
          <label>
            Nombre de nueva localidad
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button
            className="editor-action-primary"
            onClick={() => act(() => addProjectLocality(project, { id, name, cellId: cell?.id }))}
          >
            Crear en casilla elegida
          </button>
        </div>
      </details>
      <section className="studio-locality-panel">
        <h3>Localidades</h3>
        <div className="studio-row">
          <label>
            Localidad
            <select value={sector?.id ?? ''} onChange={(e) => chooseLocality(e.target.value)}>
              {world.theaters.map((t: any) => {
                const sectors = world.sectors.filter((s: any) => s.theater === t.id);
                return sectors.length ? (
                  <optgroup key={t.id} label={t.name}>
                    {sectors.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
              {world.sectors
                .filter((s: any) => !world.theaters.some((t: any) => t.id === s.theater))
                .map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="editor-action-quiet"
            disabled={!anchor}
            onClick={() => selectCell(anchor, true)}
          >
            Ir a cabecera
          </button>
        </div>
        {sector && (
          <>
            <p className="editor-help">
              Editando {sector.name} · {regionName(sector.theater)} · Cabecera{' '}
              {anchor?.grid ?? 'sin asignar'}. Para moverla, elegí la casilla de destino en el mapa.
            </p>
            <div className="studio-row">
              <label>
                Nombre
                <input
                  value={sector.name}
                  onChange={(e) =>
                    act(() => updateProjectLocality(project, sector.id, { name: e.target.value }))
                  }
                />
              </label>
              <label>
                Nombre corto
                <input
                  value={sector.shortName ?? ''}
                  onChange={(e) =>
                    act(() =>
                      updateProjectLocality(project, sector.id, { shortName: e.target.value }),
                    )
                  }
                />
              </label>
              <label>
                Ingreso
                <input
                  type="number"
                  min={0}
                  value={sector.income ?? 0}
                  onChange={(e) =>
                    act(() =>
                      updateProjectLocality(project, sector.id, { income: e.target.valueAsNumber }),
                    )
                  }
                />
              </label>
              <button onClick={() => act(() => moveProjectLocality(project, sector.id, cell?.id))}>
                Mover cabecera aquí
              </button>
              <button
                className="editor-action-danger"
                onClick={() => act(() => deleteProjectLocality(project, sector.id))}
              >
                Eliminar localidad
              </button>
            </div>
            <h3>Caminos entre localidades</h3>
            <p className="editor-help">
              Cada enlace conecta ambas localidades. Las casillas del camino deben permitir el paso
              terrestre.
            </p>
            <div className="studio-row">
              {world.sectors
                .filter((s: any) => s.id !== sector.id)
                .map((s: any) => (
                  <label key={s.id}>
                    <input
                      type="checkbox"
                      checked={sector.neighbors.includes(s.id)}
                      onChange={(e) =>
                        act(() =>
                          setProjectLocalityLink(project, sector.id, s.id, e.target.checked),
                        )
                      }
                    />
                    {s.name}
                  </label>
                ))}
            </div>
            <details>
              <summary>Otros campos de la localidad</summary>
              <FieldEditor
                value={Object.fromEntries(
                  Object.entries(sector).filter(
                    ([key]) => !['id', 'grid', 'neighbors'].includes(key),
                  ),
                )}
                onChange={(value) => act(() => updateProjectLocality(project, sector.id, value))}
                path={`world.sectors.${sector.id}`}
              />
            </details>
          </>
        )}
      </section>
      {Object.entries(groups).map(([title, keys]) => (
        <details key={title}>
          <summary>{title}</summary>
          <div className="studio-fields">
            {keys.map((key) => (
              <FieldEditor
                key={key}
                value={world[key]}
                label={key}
                path={`world.${key}`}
                onChange={(value) => worldField(key, value)}
              />
            ))}
          </div>
        </details>
      ))}
      <details>
        <summary>Documento completo del mundo</summary>
        <p>
          Este modo permite editar todos los campos admitidos. Validá el proyecto después de cambiar
          identidades o referencias.
        </p>
        <DocumentEditor
          value={world}
          onChange={(value) => onChange({ ...project, world: value })}
          path="world"
        />
      </details>
    </section>
  );
}
