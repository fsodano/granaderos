'use client';
import type {
  PhysicalMap,
  CampaignContent,
} from '../../../../../packages/campaign-format/types.ts';
import type { BattleSnapshot } from '../../../../../packages/game/public/campaign-editor-api.ts';
import type {
  MapLayer,
  MapSelection,
  MapBuildingTemplate,
  MapTerrain,
  SectorMapCommand,
  SectorMapHistorySnapshot,
  MapObjectValues,
} from '../../../domain/sector-map-command.ts';
import { selectValue } from '../../lib/editor-values.ts';
import {
  parseEditorJson,
  documentObject,
  readBuildingTemplate,
} from '../../lib/editor-documents.ts';
import { editorErrorMessage } from '../../../infrastructure/editor-error-message.ts';
import { gamePath } from '../../lib/game-path.ts';
import { pagePath } from '../../../../web/game-preview-assets.js';
import { BuildIdentity } from '../../../../web/game-preview.ts';
import { isometricWallEdge } from '../../lib/editor-wall-edge.js';
import {
  wallEdgeCells,
  wallEdgeEndpoints,
} from '../../../../../packages/game/public/campaign-editor-api.ts';
import {
  WALL_FINISHES,
  ROOF_FINISHES,
  DOOR_STYLES,
  WINDOW_STYLES,
} from '../../../../../packages/game/public/campaign-editor-api.ts';
import { BUILDING_KINDS } from '../../../../../packages/game/public/campaign-editor-api.ts';
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react';
import { TacticalScene } from '../../../../web/game-preview.ts';
import { Battlefield } from '../../../../web/game-preview.ts';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  editorCampaignBase,
  editorCampaignURL,
  editorDraftKey,
} from '../../lib/editor-campaign.ts';
import {
  loadInstalledCampaign,
  type CampaignEntry,
  type LoadedCampaign,
} from '../../lib/campaign-library.ts';
import { campaignPresentation } from '../../../../../packages/game/public/campaign-editor-api.ts';
import { campaignFactionName } from '../../../../../packages/game/public/campaign-editor-api.ts';
import {
  blankMap,
  parseMap,
  serializeMap,
  validateMap,
} from '../../../../../packages/game/public/campaign-editor-api.ts';
import {
  compileMap,
  reachableMap,
} from '../../../../../packages/game/public/campaign-editor-api.ts';
import {
  editSectorMapDocument,
  selectionRoots,
  createSectorMapHistory,
  editSectorMap,
  undoSectorMapEdit,
  redoSectorMapEdit,
  buildingTemplate,
} from '../../../public/map-editing-api.js';
import {
  TERRAIN,
  FEATURES,
  FURNITURE,
  ITEM_TYPES,
  LAYERS,
  cellKey,
} from '../../../../../packages/game/public/campaign-editor-api.ts';
import {
  createMapPlaytest,
  createBattle,
} from '../../../../../packages/game/public/campaign-editor-api.ts';
import { propBlocksAt } from '../../../../../packages/game/public/campaign-editor-api.ts';
import {
  rectangleCells,
  lineCells,
  isometricCell,
  seededTerrainCommands,
} from '../../../domain/map-editor-tools.js';
import { BUILDING_TEMPLATES } from '../../../../../packages/game/public/campaign-editor-api.ts';
import '../editor-tools.css';
import './editor.css';
type Point = { x: number; y: number; axis?: 'x' | 'y' };
const labels: Record<string, string> = {
  features: 'Naturaleza',
  buildings: 'Edificios',
  props: 'Mobiliario',
  items: 'Objetos',
  spawns: 'Apariciones',
  exits: 'Salidas',
  lights: 'Luces',
};
const uid = (kind: string) => `${kind}-${crypto.randomUUID()}`;
const toolGroups: { name: string; tools: [string, string][] }[] = [
  {
    name: 'Navegar',
    tools: [
      ['select', 'Seleccionar'],
      ['pan', 'Desplazar'],
      ['route', 'Medir ruta'],
    ],
  },
  {
    name: 'Construir',
    tools: [
      ['building', 'Dibujar edificio'],
      ['wall', 'Tabique'],
      ['door', 'Puerta'],
      ['window', 'Ventana'],
      ['floor', 'Quitar pared'],
    ],
  },
  { name: 'Terreno', tools: [['paint', 'Pintar']] },
];
const toolHints: Record<string, string> = {
  select: 'Hacé clic en un elemento para editarlo. Mayús suma elementos a la selección.',
  pan: 'Arrastrá el mapa para cambiar la vista. También podés usar Alt + arrastrar.',
  route: 'Elegí una casilla de inicio para ver sus rutas accesibles.',
  paint: 'Arrastrá sobre las casillas para aplicar el terreno elegido.',
  building: 'Arrastrá un rectángulo para dibujar un edificio con acceso.',
  wall: 'Arrastrá sobre un borde del edificio para crear un tabique.',
  door: 'Hacé clic en un borde del edificio para colocar una puerta.',
  window: 'Hacé clic en un borde del edificio para colocar una ventana.',
  floor: 'Hacé clic en un borde del edificio para quitar su pared.',
  place: 'Hacé clic en una casilla libre o arrastrá un elemento desde el catálogo.',
};
type LibraryMap = PhysicalMap;
type PaletteAsset = { layer: MapLayer; type: string };
type EditorGesture =
  | { kind: 'pan'; scale: number; client: Point; pan: Point }
  | { kind: 'palette'; asset: PaletteAsset }
  | { kind: 'move'; start: Point; end: Point; ids: string[] }
  | { kind: 'paint' | 'building' | 'wall'; start: Point; end: Point; cells: Point[] };
type EditorFields = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  material?: string;
  kind?: string;
  roof?: string;
  wallFinish?: string | null;
  roofFinish?: string | null;
  doorStyle?: string | null;
  windowStyle?: string | null;
  count?: number;
  radius?: number;
  intensity?: number;
  target?: string;
  side?: string;
  containerId?: string | null;
};
function entityWidth(entity: MapSelection) {
  return entity.layer === 'buildings'
    ? entity.width
    : (entity.width ?? entity.footprint?.width ?? 1);
}
function entityHeight(entity: MapSelection) {
  return entity.layer === 'buildings'
    ? entity.height
    : (entity.height ?? entity.footprint?.height ?? 1);
}

const diamond = (p: Point) =>
  `${p.x},${p.y - 14} ${p.x + 26},${p.y} ${p.x},${p.y + 14} ${p.x - 26},${p.y}`;
type SectorEditorProps = {
  document?: PhysicalMap;
  campaign?: CampaignContent;
  onDocumentChange?: (next: PhysicalMap) => void;
  embedded?: boolean;
  templates?: MapBuildingTemplate[];
  onSaveTemplate?: (template: MapBuildingTemplate) => void;
};
export default function SectorEditor({
  document: controlledDocument,
  campaign,
  onDocumentChange,
  embedded = false,
  templates = [],
  onSaveTemplate,
}: SectorEditorProps = {}) {
  const EditorRoot = embedded ? 'section' : 'main';
  const editorId = useId(),
    [mobilePanel, setMobilePanel] = useState('map'),
    [catalogueQuery, setCatalogueQuery] = useState(''),
    [draftStatus, setDraftStatus] = useState('loading');
  const validationPanel = useRef<HTMLElement>(null);
  const templateLibrary = useMemo(
    () => ({
      ...Object.fromEntries(
        Object.entries(BUILDING_TEMPLATES).map(([id, value]) => [id, readBuildingTemplate(value)]),
      ),
      ...Object.fromEntries(templates.map((t, i) => [`project-${i}`, t])),
    }),
    [templates],
  );
  const [wallSide, setWallSide] = useState('north');
  const [exportFile, setExportFile] = useState<{
    name: string;
    text: string;
    url: string;
  } | null>(null);
  const exportUrl = exportFile?.url;
  useEffect(
    () => () => {
      if (exportUrl) {
        URL.revokeObjectURL(exportUrl);
      }
    },
    [exportUrl],
  );
  function download(name: string, text: string) {
    setExportFile({
      name,
      text,
      url: URL.createObjectURL(new Blob([text], { type: 'application/json' })),
    });
  }

  const [history, setHistory] = useState<SectorMapHistorySnapshot>(() =>
      createSectorMapHistory(controlledDocument ?? blankMap()),
    ),
    doc = embedded && controlledDocument ? controlledDocument : history.document;
  const [notice, setNotice] = useState('Elige una herramienta o arrastra un elemento al mapa.');
  const [tool, setTool] = useState('select'),
    [terrain, setTerrain] = useState<MapTerrain>('grass'),
    [brush, setBrush] = useState('brush');
  const [asset, setAsset] = useState<PaletteAsset>({ layer: 'props', type: 'table' }),
    [selected, setSelected] = useState<string[]>([]);
  const [hover, setHover] = useState<Point | null>(null),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeRoomId, setActiveRoomId] = useState('');
  const [view, setView] = useState('interior'),
    [overlay, setOverlay] = useState('grid'),
    [routeStart, setRouteStart] = useState<Point | null>(null);
  const [hidden, setHidden] = useState<string[]>([]),
    [locked, setLocked] = useState<string[]>([]),
    [battle, setBattle] = useState<BattleSnapshot | null>(null);
  const [template, setTemplate] = useState<MapBuildingTemplate | null>(null),
    [ready, setReady] = useState(embedded),
    [recover, setRecover] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 20, height: 16 }),
    [buildingSize, setBuildingSize] = useState({ width: 5, height: 5 });
  const [seed, setSeed] = useState(1810);
  const [sector, setSector] = useState(''),
    [fieldEdits, setFieldEdits] = useState<{ selectionKey: string; fields: EditorFields } | null>(
      null,
    );
  const [library, setLibrary] = useState<Record<string, LibraryMap>>({}),
    [campaigns, setCampaigns] = useState<CampaignEntry[]>([]),
    [campaignId, setCampaignId] = useState('granaderos'),
    [draftKey, setDraftKey] = useState(editorDraftKey('sector', 'granaderos'));
  const [loadedCampaignContent, setCampaignContent] = useState<CampaignContent | null>(
    campaign ?? null,
  );
  const campaignContent = embedded ? (campaign ?? null) : loadedCampaignContent;
  const [loadingCampaign, setLoadingCampaign] = useState(!embedded);
  const loadingSequence = useRef(0);
  const svg = useRef<SVGSVGElement>(null),
    file = useRef<HTMLInputElement>(null);
  const [gesture, setGesture] = useState<EditorGesture | null>(null);
  const map = useMemo(() => compileMap(doc), [doc]),
    report = useMemo(() => validateMap(doc), [doc]),
    playtestReport = useMemo(() => validateMap(doc, { playable: true }), [doc]);
  const all: MapSelection[] = [];
  for (const layer of LAYERS) {
    if (layer === 'buildings') {
      all.push(...doc.buildings.map((entry) => ({ ...entry, layer })));
    } else {
      all.push(...doc[layer].map((entry) => ({ ...entry, layer })));
    }
  }
  const chosen = all.find((entry) => entry.id === selected[0]);
  const selectionKey = `${doc.id}:${doc.revision}:${selected.join(',')}`;
  const fields: EditorFields =
    fieldEdits?.selectionKey === selectionKey
      ? fieldEdits.fields
      : chosen
        ? { ...chosen, width: entityWidth(chosen), height: entityHeight(chosen) }
        : {};
  const placedName =
    asset.layer === 'features'
      ? Object.entries(FEATURES).find(([id]) => id === asset.type)?.[1]?.name
      : asset.layer === 'props'
        ? Object.entries(FURNITURE).find(([id]) => id === asset.type)?.[1]?.name
        : asset.layer === 'items'
          ? Object.entries(ITEM_TYPES).find(([id]) => id === asset.type)?.[1]
          : asset.layer === 'buildings'
            ? (template?.name ?? 'Casa colonial')
            : asset.layer === 'spawns'
              ? asset.type === 'player'
                ? campaignFactionName(campaignContent, 'patriot')
                : asset.type === 'enemy'
                  ? campaignFactionName(campaignContent, 'royalist')
                  : 'Vecino'
              : asset.layer === 'lights'
                ? 'Farol'
                : asset.layer === 'exits'
                  ? 'Salida'
                  : labels[asset.layer];
  const activeToolName =
    tool === 'place'
      ? `Colocar: ${placedName ?? asset.type}`
      : (toolGroups.flatMap((group) => group.tools).find(([id]) => id === tool)?.[1] ?? tool);
  const searchText = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase();
  const matchesCatalogue = (name: string) =>
    searchText(name).includes(searchText(catalogueQuery.trim()));
  const catalogueNames = [
    ...Object.values(FEATURES).map((s) => s.name),
    ...Object.values(FURNITURE).map((s) => `${s.name} · ${s.width}×${s.height}`),
    ...Object.values(ITEM_TYPES),
    template ? `Plantilla: ${template.name}` : 'Casa colonial',
    campaignFactionName(campaignContent, 'patriot'),
    campaignFactionName(campaignContent, 'royalist'),
    'Vecino',
    'Farol',
    'Salida',
  ];
  const catalogueMatches = catalogueNames.filter(matchesCatalogue).length;
  const world = {
    width: (doc.width + doc.height) * 26 + 120,
    height: (doc.width + doc.height) * 14 + 160,
  };
  const project = (x: number, y: number) => ({
    x: doc.height * 26 + 60 + (x - y) * 26,
    y: 80 + (x + y) * 14,
  });
  const camera = {
    x: pan.x,
    y: pan.y,
    width: world.width / zoom,
    height: world.height / zoom,
  };
  const reached = useMemo(
    () => reachableMap(map, routeStart ?? doc.spawns.find((s) => s.side === 'player')),
    [map, routeStart, doc.spawns],
  );
  const doorApproaches = useMemo(
    () =>
      new Set(
        (map.wallEdges ?? map.tiles)
          .filter((t) => t.type === 'door')
          .flatMap((t) =>
            (t.axis
              ? wallEdgeCells(t)
              : [
                  { x: t.x - 1, y: t.y },
                  { x: t.x + 1, y: t.y },
                  { x: t.x, y: t.y - 1 },
                  { x: t.x, y: t.y + 1 },
                ]
            )
              .filter((p) => !map.tiles.find((v) => v.x === p.x && v.y === p.y)?.blocked)
              .map(cellKey),
          ),
      ),
    [map],
  );
  const allRooms = map.buildings.flatMap((b) => b.rooms.map((r) => r.id));
  const activeBuilding =
    chosen?.layer === 'buildings'
      ? chosen
      : map.buildings.find(
          (b) =>
            chosen &&
            chosen.x > b.x &&
            chosen.x < b.x + b.width - 1 &&
            chosen.y > b.y &&
            chosen.y < b.y + b.height - 1,
        );
  const revealed = new Set<string>(
    view === 'exterior'
      ? []
      : view === 'room'
        ? allRooms.includes(activeRoomId)
          ? [activeRoomId]
          : activeBuilding?.rooms[0]
            ? [activeBuilding.rooms[0].id]
            : []
        : allRooms,
  );
  const visualMap = useMemo(
    () => (hidden.includes('features') ? compileMap({ ...doc, features: [] }) : map),
    [doc, hidden, map],
  );
  const scene = useMemo(
    () =>
      createBattle([], {
        ...visualMap,
        ...(campaignContent ? { campaignPackage: campaignContent } : {}),
        tiles: visualMap.tiles.map((t) =>
          hidden.includes('buildings') && t.buildingId
            ? (doc.terrain.find((v) => cellKey(v) === cellKey(t)) ?? t)
            : t,
        ),
        buildings: hidden.includes('buildings') ? [] : map.buildings,
        wallEdges: hidden.includes('buildings') ? [] : visualMap.wallEdges,
        props: hidden.includes('props') ? [] : map.props,
        lights: hidden.includes('lights') ? [] : map.lights,
        units: [],
        enemies: [],
        exploration: true,
        npcs: [],
        artillery: [],
        smoke: [],
      }),
    [visualMap, campaignContent, hidden, doc.terrain, map],
  );
  const drag = gesture;
  const preview = (() => {
    if (!hover) {
      return [];
    }
    if (drag?.kind === 'building' || (drag?.kind === 'paint' && brush === 'rectangle')) {
      return rectangleCells(drag.start, hover);
    }
    if (drag?.kind === 'paint') {
      return drag.cells;
    }
    if (drag?.kind === 'wall') {
      const axis = drag.start.axis ?? 'x',
        length = Math.abs(axis === 'x' ? hover.x - drag.start.x : hover.y - drag.start.y),
        sign = Math.sign(axis === 'x' ? hover.x - drag.start.x : hover.y - drag.start.y);
      return Array.from({ length: length + 1 }, (_, i) => ({
        x: drag.start.x + (axis === 'x' ? i * sign : 0),
        y: drag.start.y + (axis === 'y' ? i * sign : 0),
        axis,
      }));
    }
    const choice = drag?.kind === 'palette' ? drag.asset : asset;
    if (tool === 'place' || drag?.kind === 'palette') {
      const size =
        choice.layer === 'buildings'
          ? (template?.building ?? buildingSize)
          : choice.layer === 'props'
            ? (Object.entries(FURNITURE).find(([id]) => id === choice.type)?.[1] ?? {
                width: 1,
                height: 1,
              })
            : { width: 1, height: 1 };
      return Array.from({ length: Math.min(4096, size.width * size.height) }, (_, i) => ({
        x: hover.x + (i % size.width),
        y: hover.y + Math.floor(i / size.width),
      }));
    }
    if (drag?.kind === 'move') {
      return all
        .filter((e) => drag.ids.includes(e.id))
        .flatMap((e) => {
          const w = entityWidth(e),
            h = entityHeight(e);
          return Array.from({ length: w * h }, (_, i) => ({
            x: e.x + (i % w) + hover.x - drag.start.x,
            y: e.y + Math.floor(i / w) + hover.y - drag.start.y,
          }));
        });
    }
    return [hover];
  })();
  const previewBlocked = preview.some(
    (p: Point) =>
      p.x < 0 ||
      p.y < 0 ||
      p.x >= doc.width + (p.axis === 'y' ? 1 : 0) ||
      p.y >= doc.height + (p.axis === 'x' ? 1 : 0) ||
      ((tool === 'place' || drag?.kind === 'palette') &&
        ['props', 'buildings', 'features', 'spawns'].includes(
          (drag?.kind === 'palette' ? drag.asset : asset).layer,
        ) &&
        (map.tiles.find((t) => cellKey(t) === cellKey(p))?.blocked || propBlocksAt(map, p.x, p.y))),
  );
  function edit(commands: readonly SectorMapCommand[]) {
    if (
      commands.some((c) => {
        const e = all.find(
          (e) =>
            e.id === ('id' in c ? c.id : 'buildingId' in c ? c.buildingId : undefined) ||
            (c.type === 'setDoor' &&
              e.layer === 'buildings' &&
              e.walls.some((w) => w.doorId === c.id)),
        );
        if (
          c.type === 'transformSelection' &&
          c.ids.some((id: string) =>
            (() => {
              const root = all.find((o) => o.id === id);
              return (
                (root && locked.includes(root.layer)) ||
                (root?.layer === 'buildings' &&
                  all.some(
                    (child) =>
                      locked.includes(child.layer) &&
                      child.x >= root.x &&
                      child.x < root.x + root.width &&
                      child.y >= root.y &&
                      child.y < root.y + root.height,
                  )) ||
                (root?.layer !== 'buildings' &&
                  root?.type === 'chest' &&
                  locked.includes('items') &&
                  doc.items.some((item) => item.containerId === root.id))
              );
            })(),
          )
        ) {
          return true;
        }
        return (
          (e && locked.includes(e.layer)) ||
          (e?.layer === 'buildings' &&
            all.some(
              (child) =>
                locked.includes(child.layer) &&
                child.x >= e.x &&
                child.x < e.x + e.width &&
                child.y >= e.y &&
                child.y < e.y + e.height,
            )) ||
          (c.type === 'addObject' && locked.includes(c.layer)) ||
          (c.type === 'paintTerrain' && locked.includes('terrain')) ||
          (['addBuilding', 'stampTemplate'].includes(c.type) && locked.includes('buildings'))
        );
      })
    ) {
      setNotice('La capa está bloqueada.');
      return false;
    }
    const next = editSectorMap(embedded ? createSectorMapHistory(doc) : history, commands);
    if (next.errors?.length) {
      setNotice(next.errors.join(' '));
      return false;
    }
    applyHistory(next);
    setNotice('Cambio aplicado.');
    return true;
  }
  function replace(next: PhysicalMap) {
    if (embedded && (next.width !== 20 || next.height !== 16 || next.id !== doc.id)) {
      setNotice('El mapa debe conservar su identidad y medir 20 × 16.');
      return;
    }
    if (
      !embedded &&
      history.past.length &&
      !window.confirm('¿Abrir otro mapa? Exporta primero los cambios que quieras conservar.')
    ) {
      return;
    }
    setRecover(null);
    applyHistory(createSectorMapHistory(next));
    setSelected([]);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setRouteStart(null);
    setNotice('Mapa abierto.');
  }
  function openBase(loaded: LoadedCampaign) {
    const maps = loaded.content.maps ?? {},
      first =
        (loaded.content.headquarters ? maps[loaded.content.headquarters] : undefined) ??
        Object.values(maps)[0],
      key = editorDraftKey('sector', loaded.entry.id);
    setLibrary(maps);
    setCampaignContent(loaded.content);
    setCampaignId(loaded.entry.id);
    setDraftKey(key);
    editorCampaignURL(loaded.entry);
    setHistory(createSectorMapHistory(structuredClone(first ?? blankMap())));
    setSector(first?.id ?? '');
    setSelected([]);
    setBattle(null);
    setRecover(null);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setRouteStart(null);
    try {
      const stored =
        localStorage.getItem(key) ??
        (loaded.entry.id === 'granaderos'
          ? localStorage.getItem('granaderos-sector-editor-v1')
          : null);
      if (stored) {
        setRecover(stored);
      }
    } catch {
      setNotice('La recuperación local no está disponible. Exporta tus cambios.');
    }
    setReady(true);
  }
  const openInitialBase = useEffectEvent(openBase);
  useEffect(() => {
    if (embedded) {
      return;
    }
    let active = true;
    editorCampaignBase()
      .then(({ entries, loaded }) => {
        if (active) {
          setCampaigns(entries);
          openInitialBase(loaded);
        }
      })
      .catch((error: Error) => {
        if (active) {
          setNotice(editorErrorMessage(error));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingCampaign(false);
        }
      });
    return () => {
      active = false;
    };
  }, [embedded]);
  async function chooseBase(entry: CampaignEntry) {
    const sequence = ++loadingSequence.current;
    setReady(false);
    setLoadingCampaign(true);
    try {
      const loaded = await loadInstalledCampaign(entry);
      if (sequence === loadingSequence.current) {
        openBase(loaded);
        setNotice('Campaña abierta.');
      }
    } catch (error) {
      if (sequence === loadingSequence.current) {
        setNotice(
          error instanceof Error ? editorErrorMessage(error) : 'No se pudo abrir la campaña.',
        );
      }
    } finally {
      if (sequence === loadingSequence.current) {
        setLoadingCampaign(false);
      }
    }
  }
  function applyHistory(next: SectorMapHistorySnapshot) {
    if (embedded) {
      onDocumentChange?.(next.document);
    } else {
      setHistory(next);
      if (ready) {
        try {
          localStorage.setItem(draftKey, serializeMap(next.document));
          setDraftStatus('saved');
        } catch {
          setDraftStatus('error');
          setNotice('No se pudo guardar el borrador. Exporta el mapa.');
        }
      }
    }
  }
  function at(clientX: number, clientY: number) {
    const box = svg.current?.getBoundingClientRect();
    return box
      ? (['door', 'window', 'wall', 'floor'].includes(tool) ? isometricWallEdge : isometricCell)(
          { x: clientX, y: clientY },
          box,
          camera,
          { x: doc.height * 26 + 60, y: 80 },
          { width: doc.width, height: doc.height },
        )
      : null;
  }
  function hit(p: Point) {
    return [...all]
      .reverse()
      .find(
        (e) =>
          !hidden.includes(e.layer) &&
          !locked.includes(e.layer) &&
          p.x >= e.x &&
          p.x < e.x + entityWidth(e) &&
          p.y >= e.y &&
          p.y < e.y + entityHeight(e),
      );
  }
  function commandFor(p: Point, choice = asset): SectorMapCommand {
    if (choice.layer === 'buildings') {
      return template
        ? { type: 'stampTemplate', template, id: uid('building'), ...p }
        : {
            type: 'addBuilding',
            building: { id: uid('building'), ...p, ...buildingSize, name: 'Casa colonial' },
          };
    }
    const chest = doc.props.find(
      (entry) => entry.type === 'chest' && entry.x === p.x && entry.y === p.y,
    );
    return {
      type: 'addObject',
      layer: choice.layer,
      object: {
        id: uid(choice.layer),
        ...p,
        type: choice.type,
        ...(choice.layer === 'spawns'
          ? {
              side: choice.type,
              name:
                choice.type === 'player'
                  ? campaignFactionName(campaignContent, 'patriot')
                  : choice.type === 'enemy'
                    ? campaignFactionName(campaignContent, 'royalist')
                    : 'Vecino',
            }
          : {}),
        ...(choice.layer === 'items'
          ? {
              count: 10,
              ...(chest ? { containerId: chest.id } : {}),
            }
          : {}),
        ...(choice.layer === 'exits'
          ? { target: sector || Object.keys(library)[0] || doc.id }
          : {}),
        ...(choice.layer === 'lights' ? { radius: 4, intensity: 0.8, type: 'lantern' } : {}),
      },
    };
  }
  function keyboardEdge(p: Point): Point {
    return {
      x: p.x + (wallSide === 'east' ? 1 : 0),
      y: p.y + (wallSide === 'south' ? 1 : 0),
      axis: ['north', 'south'].includes(wallSide) ? 'x' : 'y',
    };
  }
  function edgeBuilding(p: Point) {
    return map.buildings.find((b) =>
      p.axis === 'x'
        ? p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y <= b.y + b.height
        : p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y < b.y + b.height,
    );
  }
  function click(p: Point) {
    const room = map.tiles.find((t) => cellKey(t) === cellKey(p))?.roomId;
    if (room) {
      setActiveRoomId(room);
    }
    if (tool === 'route') {
      setRouteStart(p);
      setOverlay('routes');
      return;
    }
    if (tool === 'place') {
      if (locked.includes(asset.layer) || hidden.includes(asset.layer)) {
        setNotice('La capa está bloqueada u oculta.');
        return;
      }
      edit([commandFor(p)]);
      return;
    }
    if (tool === 'door' || tool === 'window' || tool === 'wall' || tool === 'floor') {
      p = p.axis ? p : keyboardEdge(p);
      const b = edgeBuilding(p);
      if (!b || locked.includes('buildings')) {
        setNotice('Selecciona una casilla de edificio desbloqueado.');
        return;
      }
      edit([{ type: 'setWall', buildingId: b.id, ...p, wallType: tool }]);
      return;
    }
    const e = hit(p);
    setSelected(e ? [e.id] : []);
  }
  function start(e: React.PointerEvent) {
    if (e.button === 1 || e.altKey || tool === 'pan') {
      const box = svg.current?.getBoundingClientRect();
      if (!box) {
        return;
      }
      setGesture({
        kind: 'pan',
        scale: Math.min(box.width / camera.width, box.height / camera.height),
        client: { x: e.clientX, y: e.clientY },
        pan,
      });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) {
      return;
    }
    const p = at(e.clientX, e.clientY);
    if (!p) {
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === 'paint' || tool === 'building' || tool === 'wall') {
      setGesture({ kind: tool, start: p, end: p, cells: [p] });
      setHover(p);
      return;
    }
    if (tool === 'select') {
      const object = hit(p);
      if (object) {
        const ids = e.shiftKey
          ? [...new Set([...selected, object.id])]
          : selected.includes(object.id)
            ? selected
            : [object.id];
        setSelected(ids);
        setGesture({ kind: 'move', start: p, end: p, ids });
      } else {
        setSelected([]);
      }
    } else {
      click(p);
    }
  }
  function finish(p: Point | null) {
    const g = gesture;
    setGesture(null);
    if (!g || g.kind === 'pan') {
      return;
    }
    if (!p) {
      setNotice(
        g.kind === 'palette'
          ? 'Haz clic en una casilla para colocar el elemento.'
          : 'Acción cancelada fuera del mapa.',
      );
      return;
    }
    if (g.kind === 'palette') {
      edit([commandFor(p, g.asset)]);
      return;
    }
    if (g.kind === 'move') {
      const dx = p.x - g.start.x,
        dy = p.y - g.start.y;
      if (!dx && !dy) {
        return;
      }
      edit([{ type: 'transformSelection', ids: g.ids, dx, dy }]);
      return;
    }
    if (g.kind === 'building') {
      const x = Math.min(p.x, g.start.x),
        y = Math.min(p.y, g.start.y);
      edit([
        {
          type: 'addBuilding',
          building: {
            id: uid('building'),
            x,
            y,
            width: Math.max(3, Math.abs(p.x - g.start.x) + 1),
            height: Math.max(3, Math.abs(p.y - g.start.y) + 1),
            name: 'Casa colonial',
          },
        },
      ]);
      return;
    }
    if (g.kind === 'wall') {
      const b = edgeBuilding(g.start);
      if (!b) {
        return;
      }
      const axis = g.start.axis ?? 'x',
        length = Math.abs(axis === 'x' ? p.x - g.start.x : p.y - g.start.y),
        sign = Math.sign(axis === 'x' ? p.x - g.start.x : p.y - g.start.y);
      edit(
        Array.from({ length: length + 1 }, (_, i) => ({
          type: 'setWall',
          buildingId: b.id,
          x: g.start.x + (axis === 'x' ? i * sign : 0),
          y: g.start.y + (axis === 'y' ? i * sign : 0),
          axis,
          wallType: 'wall',
        })),
      );
      return;
    }
    if (g.kind === 'paint') {
      let cells = g.cells;
      if (brush === 'rectangle') {
        cells = Array.from(
          {
            length: (Math.abs(p.x - g.start.x) + 1) * (Math.abs(p.y - g.start.y) + 1),
          },
          (_, i) => ({
            x: Math.min(p.x, g.start.x) + (i % (Math.abs(p.x - g.start.x) + 1)),
            y: Math.min(p.y, g.start.y) + Math.floor(i / (Math.abs(p.x - g.start.x) + 1)),
          }),
        );
      }
      if (brush === 'fill') {
        const base = doc.terrain.find((t) => cellKey(t) === cellKey(p))?.type,
          seen = new Set([cellKey(p)]);
        cells = [p];
        for (let i = 0; i < cells.length; i++) {
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            const currentCell = cells[i];
            if (!currentCell) {
              continue;
            }
            const t = doc.terrain.find(
              (t) => t.x === currentCell.x + dx && t.y === currentCell.y + dy,
            );
            if (t && t.type === base && !seen.has(cellKey(t))) {
              seen.add(cellKey(t));
              cells.push({ x: t.x, y: t.y });
            }
          }
        }
      }
      edit([{ type: 'paintTerrain', cells, terrain }]);
    }
  }
  const movePointer = useEffectEvent((event: PointerEvent) => {
    const point = at(event.clientX, event.clientY);
    setHover(point);
    if (!gesture) {
      return;
    }
    if (gesture.kind === 'pan') {
      setPan({
        x: gesture.pan.x - (event.clientX - gesture.client.x) / gesture.scale,
        y: gesture.pan.y - (event.clientY - gesture.client.y) / gesture.scale,
      });
    } else if (point && gesture.kind !== 'palette') {
      if (gesture.kind === 'paint') {
        const cells = [...gesture.cells];
        for (const cell of lineCells(cells.at(-1) ?? gesture.start, point)) {
          if (!cells.some((existing) => cellKey(existing) === cellKey(cell))) {
            cells.push(cell);
          }
        }
        setGesture({ ...gesture, end: point, cells });
      } else {
        setGesture({ ...gesture, end: point });
      }
    }
  });
  const releasePointer = useEffectEvent((event: PointerEvent) =>
    finish(at(event.clientX, event.clientY)),
  );
  useEffect(() => {
    const move = (event: PointerEvent) => movePointer(event);
    const up = (event: PointerEvent) => releasePointer(event);
    const cancel = () => {
      setGesture(null);
      setHover(null);
    };
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (battle || exportFile) {
        return;
      }
      if (e.target instanceof Element && e.target.closest('input,select,textarea')) {
        return;
      }
      if (e.key === 'Escape') {
        setGesture(null);
        setHover(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (embedded) {
          return;
        }
        e.preventDefault();
        applyHistory(e.shiftKey ? redoSectorMapEdit(history) : undoSectorMapEdit(history));
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        edit(
          selectionRoots(doc, selected).map((e) => ({
            type: 'deleteObject',
            id: e.id,
          })),
        );
        setSelected([]);
      }
      if (chosen && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        edit([
          {
            type: 'transformSelection',
            ids: selected,
            dx: e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0,
            dy: e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0,
          },
        ]);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  function palette(layer: MapLayer, type: string, name: string) {
    if (!matchesCatalogue(name)) {
      return null;
    }
    return (
      <button
        key={type}
        className={tool === 'place' && asset.layer === layer && asset.type === type ? 'active' : ''}
        aria-pressed={tool === 'place' && asset.layer === layer && asset.type === type}
        title={`Colocar ${name}. Hacé clic en el mapa o arrastrá este elemento.`}
        onClick={() => {
          setAsset({ layer, type });
          setTool('place');
        }}
        onPointerDown={(e) => {
          if (locked.includes(layer) || hidden.includes(layer)) {
            return;
          }
          setAsset({ layer, type });
          setTool('place');
          setGesture({ kind: 'palette', asset: { layer, type } });
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
      >
        {name}
      </button>
    );
  }
  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      const f = e.target.files?.[0];
      if (!f) {
        return;
      }
      const text = await f.text();
      const raw = parseEditorJson(text);
      if (documentObject(raw)['version'] === 1 && documentObject(raw)['building']) {
        const value = readBuildingTemplate(raw);
        const check = editSectorMapDocument(blankMap({ width: 64, height: 64 }), [
          {
            type: 'stampTemplate',
            id: 'template-check',
            template: value,
            x: value.building.x,
            y: value.building.y,
          },
        ]);
        if (check.errors.length) {
          throw Error(check.errors.join(' '));
        }
        setTemplate(value);
        setTool('place');
        setAsset({ layer: 'buildings', type: 'template' });
        setNotice('Plantilla lista para colocar.');
      } else {
        replace(parseMap(text));
      }
    } catch (error) {
      setNotice(editorErrorMessage(error));
    }
    e.target.value = '';
  }
  function applyFields() {
    if (!chosen) {
      return;
    }
    const cmds: SectorMapCommand[] = [];
    if (fields.x !== chosen.x || fields.y !== chosen.y) {
      cmds.push({
        type: 'moveObject',
        id: chosen.id,
        x: Number(fields.x),
        y: Number(fields.y),
      });
    }
    if (
      chosen.layer === 'buildings' &&
      (fields.width !== chosen.width || fields.height !== chosen.height)
    ) {
      cmds.push({
        type: 'resizeBuilding',
        id: chosen.id,
        width: Number(fields.width),
        height: Number(fields.height),
      });
    }
    const values: MapObjectValues = {};
    for (const key of ['name', 'material', 'kind', 'roof', 'target', 'side'] as const) {
      const value = fields[key];
      if (value !== undefined) {
        values[key] = value;
      }
    }
    for (const key of ['wallFinish', 'roofFinish', 'doorStyle', 'windowStyle'] as const) {
      const value = fields[key];
      if (value !== undefined) {
        values[key] = value;
      }
    }
    for (const key of ['count', 'radius', 'intensity'] as const) {
      const value = fields[key];
      if (value !== undefined) {
        values[key] = value;
      }
    }
    if (chosen.layer === 'items') {
      values.containerId = fields.containerId ?? null;
    }
    cmds.push({ type: 'setObject', id: chosen.id, values });
    edit(cmds);
  }
  if (battle) {
    return (
      <EditorRoot className={`sector-editor playtest${embedded ? ' embedded' : ''}`}>
        <header className="editor-header">
          <strong>Prueba del sector</strong>
          <span>Los cambios de la prueba no se guardan en el mapa.</span>
          <button onClick={() => setBattle(null)}>Volver al editor</button>
        </header>
        <Battlefield
          battle={battle}
          campaignContext={campaignContent}
          onChange={(next) => {
            setBattle(next);
            return next;
          }}
          onFinish={() => setBattle(null)}
          onMap={() => setBattle(null)}
        />
      </EditorRoot>
    );
  }
  return (
    <EditorRoot
      aria-busy={loadingCampaign}
      className={`sector-editor${embedded ? ' embedded' : ''}`}
      data-active-panel={mobilePanel}
    >
      <header className="editor-header">
        <div className="editor-identity">
          <span className="editor-eyebrow">Editor de mapas</span>
          {!embedded ? (
            <a
              href={gamePath(`/?campaign=${encodeURIComponent(campaignId)}`)}
              className="editor-brand"
            >
              {campaignContent ? campaignPresentation(campaignContent).title : 'Campaña'}
            </a>
          ) : (
            <strong>Plano táctico del proyecto</strong>
          )}
        </div>
        {!embedded && (
          <nav className="editor-navigation" aria-label="Editores">
            <a href={pagePath('/')}>Editor de campañas</a>
            <a href={pagePath(`/?workspace=story&campaign=${encodeURIComponent(campaignId)}`)}>
              Editor de historia
            </a>
            <BuildIdentity />
          </nav>
        )}
      </header>
      <div className="editor-toolbar" role="toolbar" aria-label="Acciones del mapa">
        <label className="editor-map-name">
          Nombre del mapa
          <input
            aria-label="Nombre del sector"
            value={doc.metadata.title}
            onChange={(e) => edit([{ type: 'setMetadata', values: { title: e.target.value } }])}
          />
        </label>
        {!embedded && (
          <fieldset className="editor-toolbar-group" aria-label="Historial del mapa">
            <button
              title="Deshacer el último cambio (Ctrl o ⌘ + Z)"
              onClick={() => applyHistory(undoSectorMapEdit(history))}
              disabled={!history.past.length}
            >
              Deshacer
            </button>
            <button
              title="Rehacer el último cambio (Ctrl o ⌘ + Mayús + Z)"
              onClick={() => applyHistory(redoSectorMapEdit(history))}
              disabled={!history.future.length}
            >
              Rehacer
            </button>
          </fieldset>
        )}
        <fieldset className="editor-toolbar-group" aria-label="Archivos del mapa">
          <button title="Abrir un mapa o una plantilla JSON" onClick={() => file.current?.click()}>
            Importar
          </button>
          <button
            onClick={() => {
              try {
                download(`${doc.id}.json`, serializeMap(doc));
                setNotice('Exportación lista. Guarda el archivo o copia el JSON.');
              } catch (e) {
                setNotice(editorErrorMessage(e));
              }
            }}
          >
            Exportar
          </button>
        </fieldset>
        <fieldset className="editor-toolbar-group" aria-label="Pruebas del mapa">
          <button
            className="primary"
            disabled={loadingCampaign || !playtestReport.valid}
            title={
              playtestReport.valid
                ? 'Abrir una prueba aislada con las reglas del juego'
                : playtestReport.errors.join(' ')
            }
            onClick={() => {
              try {
                setBattle(createMapPlaytest(doc, campaignContent));
              } catch (e) {
                setNotice(editorErrorMessage(e));
              }
            }}
          >
            Probar mapa
          </button>
          {embedded && (
            <button
              disabled={!playtestReport.valid}
              onClick={() => {
                try {
                  setBattle(createMapPlaytest(doc, campaignContent, { expanded: true }));
                } catch (e) {
                  setNotice(editorErrorMessage(e));
                }
              }}
            >
              Probar escena expandida
            </button>
          )}
        </fieldset>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={importFile}
        />
      </div>
      <div className="editor-document-bar" aria-label="Estado del mapa">
        <span>
          <strong>
            {doc.width} × {doc.height}
          </strong>{' '}
          casillas · revisión {doc.revision}
        </span>
        <span className="editor-document-id" title={doc.id}>
          {doc.id}
        </span>
        <span>
          {embedded
            ? 'Proyecto compartido'
            : loadingCampaign
              ? 'Cargando campaña…'
              : recover
                ? 'Borrador por recuperar'
                : draftStatus === 'saved'
                  ? 'Borrador guardado en este navegador'
                  : draftStatus === 'error'
                    ? 'Guardado local no disponible'
                    : 'Preparando borrador…'}
        </span>
        <button
          className={`editor-validation-badge ${playtestReport.valid ? 'valid' : 'invalid'}`}
          onClick={() => {
            setMobilePanel('properties');
            validationPanel.current?.scrollIntoView?.({ block: 'nearest' });
            validationPanel.current?.focus();
          }}
        >
          {playtestReport.valid
            ? 'Listo para probar'
            : `${playtestReport.errors.length} ${playtestReport.errors.length === 1 ? 'error' : 'errores'}`}{' '}
          · {report.warnings.length} {report.warnings.length === 1 ? 'aviso' : 'avisos'}
        </button>
      </div>
      {recover && (
        <div className="editor-recovery">
          Hay un borrador guardado.{' '}
          <button
            onClick={() => {
              try {
                replace(parseMap(recover));
                setRecover(null);
              } catch (e) {
                setNotice(editorErrorMessage(e));
              }
            }}
          >
            Recuperar borrador
          </button>
          <button onClick={() => setRecover(null)}>Descartar borrador</button>
        </div>
      )}
      <nav className="editor-panel-tabs" aria-label="Paneles del mapa">
        {(
          [
            ['tools', 'Herramientas'],
            ['map', 'Mapa'],
            ['properties', selected.length ? `Propiedades (${selected.length})` : 'Propiedades'],
          ] as const
        ).map(([id, name]) => (
          <button
            key={id}
            aria-pressed={mobilePanel === id}
            aria-controls={`${editorId}-${id}`}
            onClick={() => setMobilePanel(id)}
          >
            {name}
          </button>
        ))}
      </nav>
      <div className="editor-layout">
        <aside
          className="editor-palette"
          id={`${editorId}-tools`}
          aria-label="Herramientas y catálogo"
        >
          {!embedded && (
            <>
              <label>
                Campaña base
                <select
                  value={campaignId}
                  disabled={loadingCampaign}
                  onChange={(event) => {
                    const entry = campaigns.find((item) => item.id === event.target.value);
                    if (entry) {
                      void chooseBase(entry);
                    }
                  }}
                >
                  {campaigns.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
              <h2>Sector</h2>
              <select
                aria-label="Sector existente"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
              >
                {Object.entries(library).map(([id, d]) => (
                  <option key={id} value={id}>
                    {d.metadata.title}
                  </option>
                ))}
              </select>
              <button onClick={() => library[sector] && replace(structuredClone(library[sector]))}>
                Abrir sector
              </button>
              <div className="editor-pair">
                <label>
                  Ancho
                  <input
                    type="number"
                    min="4"
                    max="64"
                    value={size.width}
                    onChange={(e) => setSize({ ...size, width: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Alto
                  <input
                    type="number"
                    min="4"
                    max="64"
                    value={size.height}
                    onChange={(e) => setSize({ ...size, height: Number(e.target.value) })}
                  />
                </label>
              </div>
              <button
                onClick={() => {
                  if (size.width < 4 || size.width > 64 || size.height < 4 || size.height > 64) {
                    return;
                  }
                  replace(blankMap({ id: uid('sector'), ...size }));
                }}
              >
                Nuevo mapa
              </button>
            </>
          )}
          <h2>Herramientas</h2>
          {toolGroups.map((group) => (
            <fieldset
              className="editor-tool-group"

              aria-label={group.name}
              key={group.name}
            >
              <h3>{group.name}</h3>
              <div className="editor-tools">
                {group.tools.map(([id, name]) => (
                  <button
                    key={id}
                    aria-pressed={tool === id}
                    title={toolHints[id]}
                    className={tool === id ? 'active' : ''}
                    onClick={() => setTool(id)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          {['wall', 'door', 'window', 'floor'].includes(tool) && (
            <label>
              Borde para teclado
              <select
                aria-label="Borde de casilla para teclado"
                value={wallSide}
                onChange={(event) => setWallSide(event.target.value)}
              >
                <option value="north">Norte</option>
                <option value="south">Sur</option>
                <option value="west">Oeste</option>
                <option value="east">Este</option>
              </select>
            </label>
          )}
          <h2>Terreno</h2>
          <select
            aria-label="Tipo de terreno"
            value={terrain}
            onChange={(e) => {
              setTerrain(
                selectValue(
                  e.target.value,
                  Object.keys(TERRAIN).filter((value): value is MapTerrain =>
                    Object.hasOwn(TERRAIN, value),
                  ),
                ),
              );
              setTool('paint');
            }}
          >
            {Object.entries(TERRAIN).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Forma del pincel"
            value={brush}
            onChange={(e) => setBrush(e.target.value)}
          >
            <option value="brush">Pincel</option>
            <option value="rectangle">Rectángulo</option>
            <option value="fill">Rellenar zona</option>
          </select>
          <details>
            <summary>Generar terreno</summary>
            <label>
              Semilla
              <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
            </label>
            <button onClick={() => edit(seededTerrainCommands(doc, { seed, type: terrain }))}>
              Distribuir terreno (15%)
            </button>
          </details>
          <h2>Catálogo</h2>
          <label className="editor-catalogue-search">
            Buscar elementos
            <input
              type="search"
              aria-label="Buscar en catálogo"
              placeholder="Árbol, mesa, munición…"
              value={catalogueQuery}
              onChange={(e) => setCatalogueQuery(e.target.value)}
            />
          </label>
          {catalogueQuery.trim() && (
            <output className="editor-help">
              {catalogueMatches
                ? `${catalogueMatches} elementos encontrados.`
                : 'No hay elementos con ese nombre. Probá otra búsqueda.'}
            </output>
          )}
          <details className="editor-catalogue-group" open>
            <summary>Naturaleza</summary>
            <div className="editor-tools">
              {Object.entries(FEATURES).map(([type, s]) => palette('features', type, s.name))}
            </div>
          </details>
          <details className="editor-catalogue-group" open>
            <summary>Edificios</summary>
            <label>
              Plantilla
              <select
                aria-label="Plantilla de edificio"
                value={
                  template
                    ? (Object.entries(templateLibrary).find(([_, t]) => t === template)?.[0] ??
                      'custom')
                    : 'basic'
                }
                onChange={(e) => {
                  setTemplate(
                    Object.entries(templateLibrary).find(([id]) => id === e.target.value)?.[1] ??
                      null,
                  );
                  setAsset({ layer: 'buildings', type: 'house' });
                  setTool('place');
                }}
              >
                <option value="basic">Casa básica</option>
                {Object.entries(templateLibrary).map(([id, t]) => (
                  <option key={id} value={id}>
                    {t.name}
                  </option>
                ))}
                {template && !Object.values(templateLibrary).some((t) => t === template) && (
                  <option value="custom">{template.name}</option>
                )}
              </select>
            </label>
            <div className="editor-pair">
              <label>
                Ancho
                <input
                  type="number"
                  min="3"
                  max="20"
                  disabled={Boolean(template)}
                  value={template?.building.width ?? buildingSize.width}
                  onChange={(e) =>
                    setBuildingSize({
                      ...buildingSize,
                      width: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Alto
                <input
                  type="number"
                  min="3"
                  max="20"
                  disabled={Boolean(template)}
                  value={template?.building.height ?? buildingSize.height}
                  onChange={(e) =>
                    setBuildingSize({
                      ...buildingSize,
                      height: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            {palette(
              'buildings',
              'house',
              template ? `Plantilla: ${template.name}` : 'Casa colonial',
            )}
            {template && <button onClick={() => setTemplate(null)}>Usar casa básica</button>}
          </details>
          <details className="editor-catalogue-group" open>
            <summary>Mobiliario</summary>
            <div className="editor-tools">
              {Object.entries(FURNITURE).map(([type, s]) =>
                palette('props', type, `${s.name} · ${s.width}×${s.height}`),
              )}
            </div>
          </details>
          <details className="editor-catalogue-group" open>
            <summary>Objetos y suministros</summary>
            <div className="editor-tools">
              {Object.entries(ITEM_TYPES).map(([type, name]) => palette('items', type, name))}
            </div>
          </details>
          <details className="editor-catalogue-group" open>
            <summary>Apariciones, luces y salidas</summary>
            <div className="editor-tools">
              {palette('spawns', 'player', campaignFactionName(campaignContent, 'patriot'))}
              {palette('spawns', 'enemy', campaignFactionName(campaignContent, 'royalist'))}
              {palette('spawns', 'civilian', 'Vecino')}
              {palette('lights', 'lantern', 'Farol')}
              {palette('exits', 'exit', 'Salida')}
            </div>
          </details>
        </aside>
        <section className="editor-workspace" id={`${editorId}-map`} aria-label="Plano táctico">
          <div className="editor-tool-context">
            <strong>{activeToolName}</strong>
            <span>{toolHints[tool]}</span>
          </div>
          <div className="editor-viewbar">
            <select
              aria-label="Vista del edificio"
              value={view}
              onChange={(e) => setView(e.target.value)}
            >
              <option value="interior">Interiores</option>
              <option value="exterior">Exteriores</option>
              <option value="room">Habitación activa</option>
            </select>
            {view === 'room' && (
              <select
                aria-label="Habitación activa"
                value={activeRoomId}
                onChange={(e) => setActiveRoomId(e.target.value)}
              >
                <option value="">Seleccionar habitación</option>
                {map.buildings.flatMap((b) =>
                  b.rooms.map((r, i: number) => (
                    <option key={r.id} value={r.id}>
                      {b.name ?? 'Edificio'} · {i + 1}
                    </option>
                  )),
                )}
              </select>
            )}
            <select
              aria-label="Superposición"
              value={overlay}
              onChange={(e) => setOverlay(e.target.value)}
            >
              <option value="grid">Cuadrícula</option>
              <option value="blocked">Obstáculos</option>
              <option value="routes">Rutas accesibles</option>
              <option value="none">Sin cuadrícula</option>
            </select>
            <button
              aria-label="Alejar mapa"
              title="Alejar mapa"
              disabled={zoom <= 0.5}
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            >
              −
            </button>
            <output aria-label="Nivel de zoom">{Math.round(zoom * 100)}%</output>
            <button
              aria-label="Acercar mapa"
              title="Acercar mapa"
              disabled={zoom >= 4}
              onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            >
              +
            </button>
            <button
              onClick={() => {
                setPan({ x: 0, y: 0 });
                setZoom(1);
              }}
            >
              Centrar
            </button>
          </div>
          {all.length === 0 && (
            <div className="editor-map-empty">
              <strong>Empezá por una aparición de tu escuadra.</strong>
              <span>
                En Herramientas, abrí Apariciones, luces y salidas. Después agregá edificios y
                objetos.
              </span>
            </div>
          )}
          {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- This SVG application supports drag and pan, with keyboard-accessible cells below. */}
          <svg
            ref={svg}
            className="editor-map"
            role="application"
            aria-label="Mapa del editor"
            viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`}
            onPointerDown={start}
            onContextMenu={(e) => e.preventDefault()}
          >
            <TacticalScene
              groundOverlay={
                overlay === 'grid' ? (
                  <g data-editor-ground-grid="true" pointerEvents="none">
                    {map.tiles.map((t) => (
                      <polygon
                        key={cellKey(t)}
                        points={diamond(project(t.x, t.y))}
                        fill="none"
                        stroke="#e8dbb4"
                        strokeOpacity=".19"
                        strokeWidth=".6"
                      />
                    ))}
                  </g>
                ) : undefined
              }
              terrainVisible={!hidden.includes('terrain')}
              interactive={false}
              state={scene}
              players={[]}
              units={[]}
              selected={undefined}
              unit={undefined}
              positions={{}}
              poses={{}}
              directions={{}}
              hover={null}
              mode="move"
              aim={0}
              reachable={[]}
              showSight={false}
              sight={new Set()}
              revealed={revealed}
              project={project}
              onTile={() => {}}
              onHover={() => {}}
              onTalk={() => {}}
              onCannon={() => {}}
              cannonId=""
            />
            <g>
              {map.tiles.map((t) => {
                const p = project(t.x, t.y),
                  blocked = t.blocked || propBlocksAt(map, t.x, t.y);
                return (
                  <polygon
                    key={cellKey(t)}
                    points={diamond(p)}
                    fill={
                      overlay === 'blocked' && doorApproaches.has(cellKey(t))
                        ? '#edc566'
                        : overlay === 'blocked' && blocked
                          ? '#e76a50'
                          : overlay === 'routes'
                            ? reached.has(cellKey(t))
                              ? '#6ed391'
                              : '#b95244'
                            : 'transparent'
                    }
                    fillOpacity=".27"
                    stroke={['none', 'grid'].includes(overlay) ? 'transparent' : '#e8dbb4'}
                    strokeOpacity=".19"
                    strokeWidth=".6"
                    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- SVG cells preserve accessible keyboard activation within the map geometry.
                    role="button"
                    tabIndex={0}
                    aria-label={`Casilla ${t.x},${t.y}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (tool === 'paint') {
                          edit([{ type: 'paintTerrain', cells: [t], terrain }]);
                        } else {
                          click(t);
                        }
                      }
                    }}
                  />
                );
              })}
            </g>
            {overlay === 'blocked' &&
              !hidden.includes('buildings') &&
              (map.wallEdges ?? []).map((edge) => {
                const [a, b] = wallEdgeEndpoints(edge);
                if (!a || !b) {
                  return null;
                }
                const start = project(a.x, a.y),
                  end = project(b.x, b.y);
                return (
                  <path
                    key={edge.id}
                    data-editor-blocked-edge={edge.id}
                    d={`M${start.x},${start.y}L${end.x},${end.y}`}
                    fill="none"
                    stroke={edge.type === 'door' ? '#edc566' : '#e76a50'}
                    strokeWidth="4"
                    pointerEvents="none"
                  />
                );
              })}
            {all
              .filter(
                (e) =>
                  !hidden.includes(e.layer) &&
                  ['spawns', 'items', 'lights', 'exits', 'features'].includes(e.layer),
              )
              .map((e) => {
                const p = project(e.x, e.y);
                return (
                  <g key={e.id} pointerEvents="none">
                    <circle
                      cx={p.x}
                      cy={p.y - 7}
                      r="8"
                      fill={
                        e.layer === 'spawns'
                          ? e.side === 'enemy'
                            ? '#ad4d3d'
                            : '#4c8579'
                          : '#c09848'
                      }
                      stroke="#fff0c8"
                    />
                    <text x={p.x} y={p.y - 4} textAnchor="middle" fontSize="9" fill="#fff">
                      {e.layer === 'spawns'
                        ? '⚑'
                        : e.layer === 'items'
                          ? '◆'
                          : e.layer === 'exits'
                            ? '→'
                            : e.layer === 'lights'
                              ? '☀'
                              : '♣'}
                    </text>
                  </g>
                );
              })}
            {all
              .filter((e) => selected.includes(e.id))
              .flatMap((e) =>
                Array.from(
                  {
                    length: entityWidth(e) * entityHeight(e),
                  },
                  (_, i) => {
                    const w = entityWidth(e);
                    return (
                      <polygon
                        key={`${e.id}-${i}`}
                        points={diamond(project(e.x + (i % w), e.y + Math.floor(i / w)))}
                        fill="#69dcc5"
                        fillOpacity=".17"
                        stroke="#69dcc5"
                        strokeWidth="1.5"
                        pointerEvents="none"
                      />
                    );
                  },
                ),
              )}
            {preview.map((p: Point, i: number) =>
              p.axis ? (
                (() => {
                  const [a, b] = wallEdgeEndpoints(p);
                  if (!a || !b) {
                    return null;
                  }
                  const start = project(a.x, a.y),
                    end = project(b.x, b.y);
                  return (
                    <path
                      key={i}
                      data-editor-edge-preview={p.axis}
                      d={`M${start.x},${start.y}L${end.x},${end.y}`}
                      fill="none"
                      stroke={previewBlocked ? '#ff9986' : '#d3efb9'}
                      strokeWidth="5"
                      pointerEvents="none"
                    />
                  );
                })()
              ) : (
                <polygon
                  key={i}
                  points={diamond(project(p.x, p.y))}
                  fill={previewBlocked ? '#db6554' : '#a3d393'}
                  fillOpacity=".3"
                  stroke={previewBlocked ? '#ff9986' : '#d3efb9'}
                  strokeWidth="2"
                  pointerEvents="none"
                />
              ),
            )}
          </svg>
          <footer>
            <span>
              {hover
                ? `${hover.axis ? 'Borde ' + hover.axis : 'Casilla'} ${hover.x}, ${hover.y}`
                : 'Arrastra para colocar · Alt + arrastrar para desplazar'}
            </span>
            <span>
              {doc.width} × {doc.height} · revisión {doc.revision}
            </span>
          </footer>
        </section>
        <aside
          className="editor-inspector"
          id={`${editorId}-properties`}
          aria-label="Propiedades, capas y validación"
        >
          <section className="editor-selection-panel">
            <h2>Propiedades</h2>
            {chosen ? (
              <>
                <div className="editor-selection-summary">
                  <strong>{chosen.name ?? labels[chosen.layer] ?? 'Elemento'}</strong>
                  <code>{chosen.id}</code>
                  <p>
                    {labels[chosen.layer]} ·{' '}
                    {selected.length > 1
                      ? `${selected.length} seleccionados`
                      : ((chosen.layer === 'buildings' ? 'building' : chosen.type) ?? 'Edificio')}
                  </p>
                </div>
                {selected.length > 1 && (
                  <p className="editor-help">
                    Las propiedades corresponden al primer elemento. Girar, duplicar y eliminar se
                    aplican a toda la selección.
                  </p>
                )}
                {locked.includes(chosen.layer) && (
                  <p className="editor-warning">
                    Esta capa está bloqueada. Desbloqueala en Capas antes de editar.
                  </p>
                )}
                <label>
                  Nombre
                  <input
                    value={fields.name ?? ''}
                    onChange={(e) =>
                      setFieldEdits({ selectionKey, fields: { ...fields, name: e.target.value } })
                    }
                  />
                </label>
                <div className="editor-pair">
                  {(['x', 'y'] as const).map((k) => (
                    <label key={k}>
                      {k.toUpperCase()}
                      <input
                        type="number"
                        value={fields[k] ?? 0}
                        onChange={(e) =>
                          setFieldEdits({
                            selectionKey,
                            fields: { ...fields, [k]: Number(e.target.value) },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                {chosen.layer === 'buildings' && (
                  <>
                    <div className="editor-pair">
                      {(['width', 'height'] as const).map((k) => (
                        <label key={k}>
                          {k === 'width' ? 'Ancho' : 'Alto'}
                          <input
                            type="number"
                            min="3"
                            value={fields[k]}
                            onChange={(e) =>
                              setFieldEdits({
                                selectionKey,
                                fields: {
                                  ...fields,
                                  [k]: Number(e.target.value),
                                },
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <label>
                      Tipo de edificio
                      <select
                        aria-label="Tipo de edificio"
                        value={fields.kind ?? 'house'}
                        onChange={(e) =>
                          setFieldEdits({
                            selectionKey,
                            fields: { ...fields, kind: e.target.value },
                          })
                        }
                      >
                        {Object.entries(BUILDING_KINDS).map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Forma del techo
                      <select
                        value={fields.roof ?? chosen.roof}
                        onChange={(e) =>
                          setFieldEdits({
                            selectionKey,
                            fields: { ...fields, roof: e.target.value },
                          })
                        }
                      >
                        {['tile', 'thatch', 'terrace'].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                    {Object.entries({
                      wallFinish: WALL_FINISHES,
                      roofFinish: ROOF_FINISHES,
                      doorStyle: DOOR_STYLES,
                      windowStyle: WINDOW_STYLES,
                    }).map(([field, catalog]) => {
                      const key = selectValue(field, [
                        'wallFinish',
                        'roofFinish',
                        'doorStyle',
                        'windowStyle',
                      ]);
                      return (
                        <label key={key}>
                          {
                            (
                              {
                                wallFinish: 'Acabado de paredes',
                                roofFinish: 'Cubierta',
                                doorStyle: 'Puertas del edificio',
                                windowStyle: 'Ventanas del edificio',
                              } as Record<string, string>
                            )[key]
                          }
                          <select
                            value={fields[key] ?? ''}
                            onChange={(e) =>
                              setFieldEdits({
                                selectionKey,
                                fields: { ...fields, [key]: e.target.value || null },
                              })
                            }
                          >
                            <option value="">Heredar estilo de campaña</option>
                            {Object.entries(catalog).map(([id, name]) => (
                              <option key={id} value={id}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </>
                )}
                {(['count', 'radius', 'intensity', 'target'] as const)
                  .filter((k) => fields[k] !== undefined)
                  .map((k) => (
                    <label key={k}>
                      {
                        (
                          {
                            count: 'Cantidad',
                            radius: 'Radio',
                            intensity: 'Intensidad',
                            target: 'Destino',
                          } as const
                        )[k]
                      }
                      <input
                        type={k === 'target' ? 'text' : 'number'}
                        step={k === 'intensity' ? '.1' : '1'}
                        value={fields[k]}
                        onChange={(e) =>
                          setFieldEdits({
                            selectionKey,
                            fields: {
                              ...fields,
                              [k]: k === 'target' ? e.target.value : Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                {chosen.layer === 'items' && (
                  <label>
                    Contenedor
                    <select
                      value={fields.containerId ?? ''}
                      onChange={(e) =>
                        setFieldEdits({
                          selectionKey,
                          fields: {
                            ...fields,
                            containerId: e.target.value || null,
                          },
                        })
                      }
                    >
                      <option value="">En el suelo</option>
                      {doc.props
                        .filter((p) => p.type === 'chest')
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name ?? 'Baúl'} ({p.x}, {p.y})
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <button disabled={locked.includes(chosen.layer)} onClick={applyFields}>
                  Aplicar propiedades
                </button>
                <div className="editor-tools">
                  <button
                    onClick={() =>
                      edit([
                        {
                          type: 'transformSelection',
                          ids: selected,
                          rotate: true,
                        },
                      ])
                    }
                  >
                    Girar 90°
                  </button>
                  <button
                    onClick={() => {
                      const roots = selectionRoots(doc, selected);
                      const offset =
                        Math.max(...roots.map((e) => e.x + entityWidth(e))) -
                        Math.min(...roots.map((e) => e.x));
                      const commands = roots.map((e) => ({
                        type: 'duplicateObject' as const,
                        id: e.id,
                        newId: uid(e.layer),
                        x: e.x + offset,
                        y: e.y,
                      }));
                      if (edit(commands)) {
                        setSelected(commands.map((c) => c.newId));
                      }
                    }}
                  >
                    Duplicar
                  </button>
                  <button
                    onClick={() => {
                      edit(
                        selectionRoots(doc, selected).map((e) => ({
                          type: 'deleteObject',
                          id: e.id,
                        })),
                      );
                      setSelected([]);
                    }}
                  >
                    Eliminar
                  </button>
                </div>
                {chosen.layer === 'buildings' && (
                  <>
                    <button
                      onClick={() => {
                        const t = buildingTemplate(doc, chosen.id);
                        setTemplate(t);
                        onSaveTemplate?.(t);
                        if (!embedded) {
                          download(`${chosen.id}-template.json`, JSON.stringify(t, null, 2));
                        }
                      }}
                    >
                      Guardar plantilla
                    </button>
                    <h3>Estilos de aberturas</h3>
                    {chosen.walls
                      .filter((w) => ['door', 'window'].includes(w.type))
                      .map((w) => (
                        <label key={`${w.axis ?? 'cell'}:${w.x},${w.y}`}>
                          {w.type === 'door' ? 'Puerta' : 'Ventana'} ({w.x}, {w.y})
                          <select
                            aria-label={`Estilo de ${w.type === 'door' ? 'puerta' : 'ventana'} ${w.x},${w.y}`}
                            value={w.style ?? ''}
                            onChange={(e) =>
                              edit([
                                {
                                  type: 'setOpeningStyle',
                                  buildingId: chosen.id,
                                  x: w.x,
                                  y: w.y,
                                  axis: w.axis,
                                  style: e.target.value || null,
                                },
                              ])
                            }
                          >
                            <option value="">Del edificio</option>
                            {Object.entries(w.type === 'door' ? DOOR_STYLES : WINDOW_STYLES).map(
                              ([id, name]) => (
                                <option key={id} value={id}>
                                  {name}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      ))}
                    <h3>Puertas</h3>
                    {chosen.walls
                      .filter((w) => w.type === 'door')
                      .map((w) => (
                        <div key={w.doorId}>
                          <span>
                            {w.x}, {w.y}
                          </span>
                          <label>
                            <input
                              type="checkbox"
                              checked={w.open}
                              onChange={(e) =>
                                edit([
                                  {
                                    type: 'setDoor',
                                    id: w.doorId ?? w.id ?? '',
                                    open: e.target.checked,
                                  },
                                ])
                              }
                            />{' '}
                            Abierta
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={w.locked}
                              onChange={(e) =>
                                edit([
                                  {
                                    type: 'setDoor',
                                    id: w.doorId ?? w.id ?? '',
                                    locked: e.target.checked,
                                  },
                                ])
                              }
                            />{' '}
                            Con llave
                          </label>
                        </div>
                      ))}
                  </>
                )}
              </>
            ) : (
              <div className="editor-empty-selection">
                <strong>Ningún elemento seleccionado</strong>
                <p>
                  Usá Seleccionar y hacé clic en un edificio u objeto. Mayús permite elegir varios.
                </p>
                <p className="editor-help">Las casillas de terreno se editan con Pintar.</p>
                <button
                  onClick={() => {
                    setTool('select');
                    setMobilePanel('map');
                  }}
                >
                  Activar selección
                </button>
              </div>
            )}
          </section>
          <section className="editor-layers-panel">
            <h2>Capas</h2>
            <p className="editor-help">
              La casilla controla la vista. El candado protege la capa de cambios.
            </p>
            {['terrain', ...LAYERS].map((layer) => (
              <div className="editor-layer" key={layer}>
                <label>
                  <input
                    type="checkbox"
                    checked={!hidden.includes(layer)}
                    onChange={() =>
                      setHidden((v) =>
                        v.includes(layer) ? v.filter((x) => x !== layer) : [...v, layer],
                      )
                    }
                  />
                  {labels[layer] ?? 'Terreno'}
                </label>
                <button
                  aria-label={`Bloquear ${labels[layer] ?? 'Terreno'}`}
                  aria-pressed={locked.includes(layer)}
                  onClick={() =>
                    setLocked((v) =>
                      v.includes(layer) ? v.filter((x) => x !== layer) : [...v, layer],
                    )
                  }
                >
                  {locked.includes(layer) ? 'Bloqueada' : 'Libre'}
                </button>
              </div>
            ))}
          </section>
          <section
            className="editor-validation-panel"
            ref={validationPanel}
            tabIndex={-1}
            aria-label="Validación del mapa"
          >
            <h2>Validación</h2>
            <p className={playtestReport.valid ? 'valid' : 'invalid'}>
              {playtestReport.valid
                ? 'Sin errores de estructura. Listo para probar.'
                : `${playtestReport.errors.length} errores impiden la prueba.`}
            </p>
            {report.warnings.length === 0 && playtestReport.valid && (
              <p className="editor-help">
                Las rutas desde la entrada del jugador están conectadas. La prueba permite revisar
                el mapa con las reglas del juego.
              </p>
            )}
            {[...new Set([...playtestReport.errors, ...report.warnings])].map(
              (s: string, i: number) => (
                <p className="editor-warning" key={i}>
                  {s}
                </p>
              ),
            )}
          </section>
          <details className="editor-shortcuts">
            <summary>Atajos de teclado</summary>
            <dl>
              <div>
                <dt>Seleccionar varios</dt>
                <dd>
                  <kbd>Mayús</kbd> + clic
                </dd>
              </div>
              <div>
                <dt>Mover selección</dt>
                <dd>
                  <kbd>↑ ↓ ← →</kbd>
                </dd>
              </div>
              <div>
                <dt>Eliminar selección</dt>
                <dd>
                  <kbd>Supr</kbd>
                </dd>
              </div>
              <div>
                <dt>Desplazar vista</dt>
                <dd>
                  <kbd>Alt</kbd> + arrastrar
                </dd>
              </div>
              <div>
                <dt>Cancelar gesto</dt>
                <dd>
                  <kbd>Esc</kbd>
                </dd>
              </div>
              {!embedded && (
                <div>
                  <dt>Deshacer / rehacer</dt>
                  <dd>
                    <kbd>Ctrl / ⌘</kbd> + <kbd>Z</kbd> / <kbd>Mayús + Z</kbd>
                  </dd>
                </div>
              )}
            </dl>
            {embedded && (
              <p className="editor-help">
                Deshacer y rehacer se controlan desde el proyecto compartido.
              </p>
            )}
          </details>
        </aside>
      </div>
      <output className="editor-status" aria-live="polite">
        <span>{notice}</span>
        <span className="editor-selection-count">
          {selected.length
            ? `${selected.length} ${selected.length === 1 ? 'elemento seleccionado' : 'elementos seleccionados'}`
            : 'Sin selección'}
        </span>
      </output>
      <Dialog
        open={Boolean(exportFile)}
        onOpenChange={(open) => {
          if (!open) {
            setExportFile(null);
          }
        }}
      >
        <DialogContent className="editor-export-dialog">
          <DialogTitle>Exportar {exportFile?.name}</DialogTitle>
          <DialogDescription>
            Guarda el archivo para abrirlo en el editor o modificarlo con un script.
          </DialogDescription>
          <textarea aria-label="JSON del mapa" readOnly value={exportFile?.text ?? ''} />
          <div className="editor-export-actions">
            <a href={exportUrl} download={exportFile?.name}>
              Descargar JSON
            </a>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(exportFile?.text ?? '');
                  setNotice('JSON copiado.');
                } catch {
                  setNotice('Selecciona el texto y cópialo con el teclado.');
                }
              }}
            >
              Copiar JSON
            </button>
            <button onClick={() => setExportFile(null)}>Cerrar exportación</button>
          </div>
        </DialogContent>
      </Dialog>
    </EditorRoot>
  );
}
