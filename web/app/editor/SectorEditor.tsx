'use client';
import {
  buildingAppearance,
  WALL_FINISHES,
  ROOF_FINISHES,
  DOOR_STYLES,
  WINDOW_STYLES,
} from '../../../game/building-appearance.js';
import { BUILDING_KINDS } from '../../../game/map-catalog.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import TacticalScene from '../TacticalScene';
import Battlefield from '../Battlefield';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { MAP_LIBRARY } from '../../../game/map-library.js';
import {
  blankMap,
  parseMap,
  serializeMap,
  validateMap,
} from '../../../game/map-schema.js';
import { compileMap, reachableMap } from '../../../game/compile-map.js';
import {
  applyMapCommands,
  selectionRoots,
  createHistory,
  editHistory,
  undoHistory,
  redoHistory,
  buildingTemplate,
} from '../../../game/map-commands.js';
import {
  TERRAIN,
  FEATURES,
  FURNITURE,
  ITEM_TYPES,
  LAYERS,
  cellKey,
} from '../../../game/map-catalog.js';
import { createMapPlaytest } from '../../../game/map-playtest.js';
import { propBlocksAt } from '../../../game/props.js';
import {
  rectangleCells,
  lineCells,
  isometricCell,
  seededTerrainCommands,
} from '../../../game/map-editor-tools.js';
import { BUILDING_TEMPLATES } from '../../../game/map-templates.js';
import './editor.css';
type Point = { x: number; y: number };
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
const draftKey = 'granaderos-sector-editor-v1';
const diamond = (p: Point) =>
  `${p.x},${p.y - 14} ${p.x + 26},${p.y} ${p.x},${p.y + 14} ${p.x - 26},${p.y}`;
export default function SectorEditor() {
  const [exportFile, setExportFile] = useState<{
    name: string;
    text: string;
  } | null>(null);
  const exportUrl = useMemo(
    () =>
      exportFile
        ? URL.createObjectURL(
            new Blob([exportFile.text], { type: 'application/json' }),
          )
        : '',
    [exportFile],
  );
  useEffect(
    () => () => {
      if (exportUrl) URL.revokeObjectURL(exportUrl);
    },
    [exportUrl],
  );
  function download(name: string, text: string) {
    setExportFile({ name, text });
  }

  const [history, setHistory] = useState<any>(() =>
      createHistory(structuredClone(MAP_LIBRARY.yatasto)),
    ),
    doc = history.document;
  const [notice, setNotice] = useState(
    'Elige una herramienta o arrastra un elemento al mapa.',
  );
  const [tool, setTool] = useState('select'),
    [terrain, setTerrain] = useState('grass'),
    [brush, setBrush] = useState('brush');
  const [asset, setAsset] = useState<any>({ layer: 'props', type: 'table' }),
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
    [battle, setBattle] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null),
    [ready, setReady] = useState(false),
    [recover, setRecover] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 20, height: 16 }),
    [buildingSize, setBuildingSize] = useState({ width: 5, height: 5 });
  const [seed, setSeed] = useState(1810);
  const [sector, setSector] = useState('yatasto'),
    [fields, setFields] = useState<any>({});
  const svg = useRef<SVGSVGElement>(null),
    file = useRef<HTMLInputElement>(null),
    gesture = useRef<any>(null),
    current = useRef<any>(null);
  const map = useMemo(() => compileMap(doc), [doc]),
    report = useMemo(() => validateMap(doc), [doc]);
  const all = LAYERS.flatMap((layer) =>
      doc[layer].map((e: any) => ({ ...e, layer })),
    ),
    chosen = all.find((e: any) => e.id === selected[0]);
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
    () =>
      reachableMap(
        map,
        routeStart ?? doc.spawns.find((s: any) => s.side === 'player'),
      ),
    [map, routeStart, doc.spawns],
  );
  const doorApproaches = useMemo(
    () =>
      new Set(
        map.tiles
          .filter((t: any) => t.type === 'door')
          .flatMap((t: any) =>
            [
              { x: t.x - 1, y: t.y },
              { x: t.x + 1, y: t.y },
              { x: t.x, y: t.y - 1 },
              { x: t.x, y: t.y + 1 },
            ]
              .filter(
                (p) =>
                  !map.tiles.find((v: any) => v.x === p.x && v.y === p.y)
                    ?.blocked,
              )
              .map(cellKey),
          ),
      ),
    [map],
  );
  const allRooms = map.buildings.flatMap((b: any) =>
    b.rooms.map((r: any) => r.id),
  );
  const activeBuilding =
    chosen?.layer === 'buildings'
      ? chosen
      : map.buildings.find(
          (b: any) =>
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
  const visualMap = hidden.includes('features')
    ? compileMap({ ...doc, features: [] })
    : map;
  const scene = {
    ...visualMap,
    tiles: visualMap.tiles.map((t: any) =>
      hidden.includes('buildings') && t.buildingId
        ? doc.terrain.find((v: any) => cellKey(v) === cellKey(t))
        : t,
    ),
    buildings: hidden.includes('buildings') ? [] : map.buildings,
    props: hidden.includes('props') ? [] : map.props,
    lights: hidden.includes('lights') ? [] : map.lights,
    units: [],
    npcs: [],
    artillery: [],
    smoke: [],
  };
  const drag = gesture.current;
  const preview = useMemo(() => {
    if (!hover) return [];
    if (
      drag?.kind === 'building' ||
      (drag?.kind === 'paint' && brush === 'rectangle')
    )
      return rectangleCells(drag.start, hover);
    if (drag?.kind === 'paint') return drag.cells;
    const choice = drag?.asset ?? asset;
    if (tool === 'place' || drag?.kind === 'palette') {
      const size =
        choice.layer === 'buildings'
          ? (template?.building ?? buildingSize)
          : choice.layer === 'props'
            ? (FURNITURE as any)[choice.type]
            : { width: 1, height: 1 };
      return Array.from(
        { length: Math.min(4096, size.width * size.height) },
        (_, i) => ({
          x: hover.x + (i % size.width),
          y: hover.y + Math.floor(i / size.width),
        }),
      );
    }
    if (drag?.kind === 'move')
      return all
        .filter((e: any) => drag.ids.includes(e.id))
        .flatMap((e: any) => {
          const w = e.width ?? e.footprint?.width ?? 1,
            h = e.height ?? e.footprint?.height ?? 1;
          return Array.from({ length: w * h }, (_, i) => ({
            x: e.x + (i % w) + hover.x - drag.start.x,
            y: e.y + Math.floor(i / w) + hover.y - drag.start.y,
          }));
        });
    return [hover];
  }, [hover, tool, asset, buildingSize, template, brush, selected]);
  const previewBlocked = preview.some(
    (p: Point) =>
      p.x < 0 ||
      p.y < 0 ||
      p.x >= doc.width ||
      p.y >= doc.height ||
      ((tool === 'place' || drag?.kind === 'palette') &&
        ['props', 'buildings', 'features', 'spawns'].includes(
          (drag?.asset ?? asset).layer,
        ) &&
        (map.tiles.find((t: any) => cellKey(t) === cellKey(p))?.blocked ||
          propBlocksAt(map, p.x, p.y))),
  );
  function edit(commands: any[]) {
    if (
      commands.some((c) => {
        const e = all.find(
          (e: any) =>
            e.id === (c.id ?? c.buildingId) ||
            (c.type === 'setDoor' &&
              e.layer === 'buildings' &&
              e.walls.some((w: any) => w.doorId === c.id)),
        );
        if (
          c.ids?.some((id: string) =>
            (() => {
              const root = all.find((o: any) => o.id === id);
              return (
                locked.includes(root?.layer) ||
                (root?.layer === 'buildings' &&
                  all.some(
                    (child: any) =>
                      locked.includes(child.layer) &&
                      child.x >= root.x &&
                      child.x < root.x + root.width &&
                      child.y >= root.y &&
                      child.y < root.y + root.height,
                  )) ||
                (root?.type === 'chest' &&
                  locked.includes('items') &&
                  doc.items.some((item: any) => item.containerId === root.id))
              );
            })(),
          )
        )
          return true;
        return (
          (e && locked.includes(e.layer)) ||
          (e?.layer === 'buildings' &&
            all.some(
              (child: any) =>
                locked.includes(child.layer) &&
                child.x >= e.x &&
                child.x < e.x + e.width &&
                child.y >= e.y &&
                child.y < e.y + e.height,
            )) ||
          (c.layer && locked.includes(c.layer)) ||
          (c.type === 'paintTerrain' && locked.includes('terrain')) ||
          (['addBuilding', 'stampTemplate'].includes(c.type) &&
            locked.includes('buildings'))
        );
      })
    ) {
      setNotice('La capa está bloqueada.');
      return false;
    }
    const next = editHistory(current.current?.history ?? history, commands);
    if (next.errors?.length) {
      setNotice(next.errors.join(' '));
      return false;
    }
    setHistory(next);
    setNotice('Cambio aplicado.');
    return true;
  }
  function replace(next: any) {
    if (
      history.past.length &&
      !window.confirm(
        '¿Abrir otro mapa? Exporta primero los cambios que quieras conservar.',
      )
    )
      return;
    setRecover(null);
    setHistory(createHistory(next));
    setSelected([]);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setRouteStart(null);
    setNotice('Mapa abierto.');
  }
  useEffect(() => {
    try {
      const stored = localStorage.getItem(draftKey);
      if (stored) setRecover(stored);
    } catch {
      setNotice(
        'La recuperación local no está disponible. Exporta tus cambios.',
      );
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || recover) return;
    try {
      localStorage.setItem(draftKey, serializeMap(doc));
    } catch {
      setNotice('No se pudo guardar el borrador. Exporta el mapa.');
    }
  }, [doc, ready, recover]);
  useEffect(() => {
    setFields(
      chosen
        ? { ...chosen, width: chosen.width ?? 1, height: chosen.height ?? 1 }
        : {},
    );
  }, [selected.join(','), doc.revision]);
  function at(clientX: number, clientY: number) {
    const box = svg.current?.getBoundingClientRect();
    return box
      ? isometricCell(
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
        (e: any) =>
          !hidden.includes(e.layer) &&
          !locked.includes(e.layer) &&
          p.x >= e.x &&
          p.x < e.x + (e.width ?? e.footprint?.width ?? 1) &&
          p.y >= e.y &&
          p.y < e.y + (e.height ?? e.footprint?.height ?? 1),
      );
  }
  function commandFor(p: Point, choice = asset) {
    if (choice.layer === 'buildings')
      return {
        type: template ? 'stampTemplate' : 'addBuilding',
        ...(template
          ? { template, id: uid('building'), ...p }
          : {
              building: {
                id: uid('building'),
                ...p,
                ...buildingSize,
                name: 'Casa colonial',
              },
            }),
      };
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
                  ? 'Granadero'
                  : choice.type === 'enemy'
                    ? 'Realista'
                    : 'Vecino',
            }
          : {}),
        ...(choice.layer === 'items'
          ? {
              count: 10,
              ...(doc.props.find(
                (v: any) => v.type === 'chest' && v.x === p.x && v.y === p.y,
              )
                ? {
                    containerId: doc.props.find(
                      (v: any) =>
                        v.type === 'chest' && v.x === p.x && v.y === p.y,
                    ).id,
                  }
                : {}),
            }
          : {}),
        ...(choice.layer === 'exits' ? { target: 'retiro' } : {}),
        ...(choice.layer === 'lights'
          ? { radius: 4, intensity: 0.8, type: 'lantern' }
          : {}),
      },
    };
  }
  function click(p: Point) {
    const room = map.tiles.find((t: any) => cellKey(t) === cellKey(p))?.roomId;
    if (room) setActiveRoomId(room);
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
    if (['door', 'window', 'wall', 'floor'].includes(tool)) {
      const b = map.buildings.find(
        (b: any) =>
          p.x >= b.x &&
          p.x < b.x + b.width &&
          p.y >= b.y &&
          p.y < b.y + b.height,
      );
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
      const box = svg.current!.getBoundingClientRect();
      gesture.current = {
        kind: 'pan',
        scale: Math.min(box.width / camera.width, box.height / camera.height),
        client: { x: e.clientX, y: e.clientY },
        pan,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const p = at(e.clientX, e.clientY);
    if (!p) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === 'paint' || tool === 'building' || tool === 'wall') {
      gesture.current = { kind: tool, start: p, end: p, cells: [p] };
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
        gesture.current = { kind: 'move', start: p, end: p, ids };
      } else setSelected([]);
    } else click(p);
  }
  function finish(p: Point | null) {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.kind === 'pan') return;
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
      if (!dx && !dy) return;
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
      const b = map.buildings.find(
        (b: any) =>
          g.start.x >= b.x &&
          g.start.x < b.x + b.width &&
          g.start.y >= b.y &&
          g.start.y < b.y + b.height,
      );
      if (!b) return;
      const horizontal = Math.abs(p.x - g.start.x) >= Math.abs(p.y - g.start.y),
        length = horizontal
          ? Math.abs(p.x - g.start.x)
          : Math.abs(p.y - g.start.y);
      edit(
        Array.from({ length: length + 1 }, (_, i) => ({
          type: 'setWall',
          buildingId: b.id,
          x: g.start.x + (horizontal ? i * Math.sign(p.x - g.start.x) : 0),
          y: g.start.y + (!horizontal ? i * Math.sign(p.y - g.start.y) : 0),
          wallType: 'wall',
        })),
      );
      return;
    }
    if (g.kind === 'paint') {
      let cells = g.cells;
      if (brush === 'rectangle')
        cells = Array.from(
          {
            length:
              (Math.abs(p.x - g.start.x) + 1) * (Math.abs(p.y - g.start.y) + 1),
          },
          (_, i) => ({
            x: Math.min(p.x, g.start.x) + (i % (Math.abs(p.x - g.start.x) + 1)),
            y:
              Math.min(p.y, g.start.y) +
              Math.floor(i / (Math.abs(p.x - g.start.x) + 1)),
          }),
        );
      if (brush === 'fill') {
        const base = doc.terrain.find(
            (t: any) => cellKey(t) === cellKey(p),
          ).type,
          seen = new Set([cellKey(p)]);
        cells = [p];
        for (let i = 0; i < cells.length; i++)
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const t = doc.terrain.find(
              (t: any) => t.x === cells[i].x + dx && t.y === cells[i].y + dy,
            );
            if (t && t.type === base && !seen.has(cellKey(t))) {
              seen.add(cellKey(t));
              cells.push({ x: t.x, y: t.y });
            }
          }
      }
      edit([{ type: 'paintTerrain', cells, terrain }]);
    }
  }
  current.current = { history, at, finish };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = current.current.at(e.clientX, e.clientY);
      setHover(p);
      const g = gesture.current;
      if (!g) return;
      if (g.kind === 'pan') {
        setPan({
          x: g.pan.x - (e.clientX - g.client.x) / g.scale,
          y: g.pan.y - (e.clientY - g.client.y) / g.scale,
        });
        return;
      }
      if (p) {
        g.end = p;
        if (g.kind === 'paint') {
          for (const c of lineCells(g.cells.at(-1), p))
            if (!g.cells.some((v: Point) => cellKey(c) === cellKey(v)))
              g.cells.push(c);
        }
      }
    };
    const up = (e: PointerEvent) =>
      current.current.finish(current.current.at(e.clientX, e.clientY));
    const cancel = () => {
      gesture.current = null;
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
  }, [zoom]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (battle || exportFile) return;
      if ((e.target as HTMLElement).closest('input,select,textarea')) return;
      if (e.key === 'Escape') {
        gesture.current = null;
        setHover(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setHistory((h: any) => (e.shiftKey ? redoHistory(h) : undoHistory(h)));
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        edit(
          selectionRoots(doc, selected).map((e: any) => ({
            type: 'deleteObject',
            id: e.id,
          })),
        );
        setSelected([]);
      }
      if (
        chosen &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
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
  function palette(layer: string, type: string, name: string) {
    return (
      <button
        key={type}
        className={
          tool === 'place' && asset.layer === layer && asset.type === type
            ? 'active'
            : ''
        }
        onClick={() => {
          setAsset({ layer, type });
          setTool('place');
        }}
        onPointerDown={(e) => {
          if (locked.includes(layer) || hidden.includes(layer)) return;
          setAsset({ layer, type });
          setTool('place');
          gesture.current = { kind: 'palette', asset: { layer, type } };
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
      if (!f) return;
      const text = await f.text(),
        value = JSON.parse(text);
      if (value.version === 1 && value.building) {
        const check = applyMapCommands(blankMap({ width: 64, height: 64 }), [
          {
            type: 'stampTemplate',
            id: 'template-check',
            template: value,
            x: 0,
            y: 0,
          },
        ]);
        if (check.errors.length) throw Error(check.errors.join(' '));
        setTemplate(value);
        setTool('place');
        setAsset({ layer: 'buildings', type: 'template' });
        setNotice('Plantilla lista para colocar.');
      } else replace(parseMap(text));
    } catch (error: any) {
      setNotice(error.message);
    }
    e.target.value = '';
  }
  function applyFields() {
    if (!chosen) return;
    const cmds: any[] = [];
    if (fields.x !== chosen.x || fields.y !== chosen.y)
      cmds.push({
        type: 'moveObject',
        id: chosen.id,
        x: Number(fields.x),
        y: Number(fields.y),
      });
    if (
      chosen.layer === 'buildings' &&
      (fields.width !== chosen.width || fields.height !== chosen.height)
    )
      cmds.push({
        type: 'resizeBuilding',
        id: chosen.id,
        width: Number(fields.width),
        height: Number(fields.height),
      });
    const values: any = {};
    for (const key of [
      'name',
      'material',
      'kind',
      'wallFinish',
      'roofFinish',
      'doorStyle',
      'windowStyle',
      'count',
      'radius',
      'intensity',
      'target',
      'side',
      'containerId',
    ])
      if (fields[key] !== undefined) values[key] = fields[key];
    if (chosen.layer === 'items')
      values.containerId = fields.containerId ?? null;
    cmds.push({ type: 'setObject', id: chosen.id, values });
    edit(cmds);
  }
  if (battle)
    return (
      <main className="sector-editor playtest">
        <header>
          <strong>Prueba del sector</strong>
          <span>Los cambios de la prueba no se guardan en el mapa.</span>
          <button onClick={() => setBattle(null)}>Volver al editor</button>
        </header>
        <Battlefield
          battle={battle}
          onChange={setBattle}
          onFinish={() => setBattle(null)}
          onRetreat={() => setBattle(null)}
        />
      </main>
    );
  return (
    <main className="sector-editor">
      <header>
        <a href="/" className="editor-brand">
          GRANADEROS <small>Constructor de sectores</small>
        </a>
        <input
          aria-label="Nombre del sector"
          value={doc.metadata.title}
          onChange={(e) =>
            edit([{ type: 'setMetadata', values: { title: e.target.value } }])
          }
        />
        <button
          onClick={() => setHistory((h: any) => undoHistory(h))}
          disabled={!history.past.length}
        >
          Deshacer
        </button>
        <button
          onClick={() => setHistory((h: any) => redoHistory(h))}
          disabled={!history.future.length}
        >
          Rehacer
        </button>
        <button onClick={() => file.current?.click()}>Importar</button>
        <button
          onClick={() => {
            try {
              download(`${doc.id}.json`, serializeMap(doc));
              setNotice(
                'Exportación lista. Guarda el archivo o copia el JSON.',
              );
            } catch (e: any) {
              setNotice(e.message);
            }
          }}
        >
          Exportar
        </button>
        <button
          className="primary"
          onClick={() => {
            try {
              setBattle(createMapPlaytest(doc));
            } catch (e: any) {
              setNotice(e.message);
            }
          }}
        >
          Probar mapa
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={importFile}
        />
      </header>
      {recover && (
        <div className="editor-recovery">
          Hay un borrador guardado.{' '}
          <button
            onClick={() => {
              try {
                replace(parseMap(recover));
                setRecover(null);
              } catch (e: any) {
                setNotice(e.message);
              }
            }}
          >
            Recuperar borrador
          </button>
          <button onClick={() => setRecover(null)}>Descartar borrador</button>
        </div>
      )}
      <div className="editor-layout">
        <aside className="editor-palette">
          <h2>Sector</h2>
          <select
            aria-label="Sector existente"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
          >
            {Object.entries(MAP_LIBRARY).map(([id, d]: any) => (
              <option key={id} value={id}>
                {d.metadata.title}
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              replace(structuredClone((MAP_LIBRARY as any)[sector]))
            }
          >
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
                onChange={(e) =>
                  setSize({ ...size, width: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Alto
              <input
                type="number"
                min="4"
                max="64"
                value={size.height}
                onChange={(e) =>
                  setSize({ ...size, height: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <button
            onClick={() => {
              if (
                size.width < 4 ||
                size.width > 64 ||
                size.height < 4 ||
                size.height > 64
              )
                return;
              replace(blankMap({ id: uid('sector'), ...size }));
            }}
          >
            Nuevo mapa
          </button>
          <h2>Herramientas</h2>
          <div className="editor-tools">
            {[
              ['select', 'Seleccionar'],
              ['pan', 'Desplazar'],
              ['paint', 'Pintar'],
              ['building', 'Dibujar edificio'],
              ['wall', 'Tabique'],
              ['door', 'Puerta'],
              ['window', 'Ventana'],
              ['floor', 'Quitar pared'],
              ['route', 'Medir ruta'],
            ].map(([id, name]) => (
              <button
                key={id}
                className={tool === id ? 'active' : ''}
                onClick={() => setTool(id)}
              >
                {name}
              </button>
            ))}
          </div>
          <h2>Terreno</h2>
          <select
            aria-label="Tipo de terreno"
            value={terrain}
            onChange={(e) => {
              setTerrain(e.target.value);
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
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
              />
            </label>
            <button
              onClick={() =>
                edit(seededTerrainCommands(doc, { seed, type: terrain }))
              }
            >
              Distribuir terreno (15%)
            </button>
          </details>
          <h2>Naturaleza</h2>
          <div className="editor-tools">
            {Object.entries(FEATURES).map(([type, s]) =>
              palette('features', type, s.name),
            )}
          </div>
          <h2>Edificios</h2>
          <label>
            Plantilla
            <select
              aria-label="Plantilla de edificio"
              value={
                template
                  ? (Object.entries(BUILDING_TEMPLATES).find(
                      ([_, t]) => t === template,
                    )?.[0] ?? 'custom')
                  : 'basic'
              }
              onChange={(e) => {
                setTemplate(
                  (BUILDING_TEMPLATES as any)[e.target.value] ?? null,
                );
                setAsset({ layer: 'buildings', type: 'house' });
                setTool('place');
              }}
            >
              <option value="basic">Casa básica</option>
              {Object.entries(BUILDING_TEMPLATES).map(([id, t]) => (
                <option key={id} value={id}>
                  {t.name}
                </option>
              ))}
              {template &&
                !Object.values(BUILDING_TEMPLATES).some(
                  (t) => t === template,
                ) && <option value="custom">{template.name}</option>}
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
          {template && (
            <button onClick={() => setTemplate(null)}>Usar casa básica</button>
          )}
          <h2>Mobiliario</h2>
          <div className="editor-tools">
            {Object.entries(FURNITURE).map(([type, s]) =>
              palette('props', type, `${s.name} · ${s.width}×${s.height}`),
            )}
          </div>
          <h2>Objetos</h2>
          <div className="editor-tools">
            {Object.entries(ITEM_TYPES).map(([type, name]) =>
              palette('items', type, name),
            )}
          </div>
          <h2>Escenario</h2>
          <div className="editor-tools">
            {palette('spawns', 'player', 'Granadero')}
            {palette('spawns', 'enemy', 'Realista')}
            {palette('spawns', 'civilian', 'Vecino')}
            {palette('lights', 'lantern', 'Farol')}
            {palette('exits', 'exit', 'Salida')}
          </div>
        </aside>
        <section className="editor-workspace">
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
                {map.buildings.flatMap((b: any) =>
                  b.rooms.map((r: any, i: number) => (
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
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
              −
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
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
                    {map.tiles.map((t: any) => (
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
              selected={null}
              unit={null}
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
              {map.tiles.map((t: any) => {
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
                    stroke={
                      ['none', 'grid'].includes(overlay)
                        ? 'transparent'
                        : '#e8dbb4'
                    }
                    strokeOpacity=".19"
                    strokeWidth=".6"
                    role="button"
                    tabIndex={0}
                    aria-label={`Casilla ${t.x},${t.y}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (tool === 'paint')
                          edit([{ type: 'paintTerrain', cells: [t], terrain }]);
                        else click(t);
                      }
                    }}
                  />
                );
              })}
            </g>
            {all
              .filter(
                (e: any) =>
                  !hidden.includes(e.layer) &&
                  ['spawns', 'items', 'lights', 'exits', 'features'].includes(
                    e.layer,
                  ),
              )
              .map((e: any) => {
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
                    <text
                      x={p.x}
                      y={p.y - 4}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#fff"
                    >
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
              .filter((e: any) => selected.includes(e.id))
              .flatMap((e: any) =>
                Array.from(
                  {
                    length:
                      (e.width ?? e.footprint?.width ?? 1) *
                      (e.height ?? e.footprint?.height ?? 1),
                  },
                  (_, i) => {
                    const w = e.width ?? e.footprint?.width ?? 1;
                    return (
                      <polygon
                        key={`${e.id}-${i}`}
                        points={diamond(
                          project(e.x + (i % w), e.y + Math.floor(i / w)),
                        )}
                        fill="#f4d889"
                        fillOpacity=".17"
                        stroke="#ffdf8b"
                        strokeWidth="1.5"
                        pointerEvents="none"
                      />
                    );
                  },
                ),
              )}
            {preview.map((p: Point, i: number) => (
              <polygon
                key={i}
                points={diamond(project(p.x, p.y))}
                fill={previewBlocked ? '#db6554' : '#a3d393'}
                fillOpacity=".3"
                stroke={previewBlocked ? '#ff9986' : '#d3efb9'}
                strokeWidth="2"
                pointerEvents="none"
              />
            ))}
          </svg>
          <footer>
            <span>
              {hover
                ? `Casilla ${hover.x}, ${hover.y}`
                : 'Arrastra para colocar · Alt + arrastrar para desplazar'}
            </span>
            <span>
              {doc.width} × {doc.height} · revisión {doc.revision}
            </span>
          </footer>
        </section>
        <aside className="editor-inspector">
          <h2>Propiedades</h2>
          {chosen ? (
            <>
              <p>
                {labels[chosen.layer]} ·{' '}
                {selected.length > 1
                  ? `${selected.length} seleccionados`
                  : (chosen.type ?? 'Edificio')}
              </p>
              <label>
                Nombre
                <input
                  value={fields.name ?? ''}
                  onChange={(e) =>
                    setFields({ ...fields, name: e.target.value })
                  }
                />
              </label>
              <div className="editor-pair">
                {['x', 'y'].map((k) => (
                  <label key={k}>
                    {k.toUpperCase()}
                    <input
                      type="number"
                      value={fields[k] ?? 0}
                      onChange={(e) =>
                        setFields({ ...fields, [k]: Number(e.target.value) })
                      }
                    />
                  </label>
                ))}
              </div>
              {chosen.layer === 'buildings' && (
                <>
                  <div className="editor-pair">
                    {['width', 'height'].map((k) => (
                      <label key={k}>
                        {k === 'width' ? 'Ancho' : 'Alto'}
                        <input
                          type="number"
                          min="3"
                          value={fields[k]}
                          onChange={(e) =>
                            setFields({
                              ...fields,
                              [k]: Number(e.target.value),
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
                        setFields({ ...fields, kind: e.target.value })
                      }
                    >
                      {Object.entries(BUILDING_KINDS).map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {Object.entries({
                    wallFinish: WALL_FINISHES,
                    roofFinish: ROOF_FINISHES,
                    doorStyle: DOOR_STYLES,
                    windowStyle: WINDOW_STYLES,
                  }).map(([key, catalog]) => (
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
                        value={fields[key] ?? buildingAppearance(chosen)[key]}
                        onChange={(e) =>
                          setFields({ ...fields, [key]: e.target.value })
                        }
                      >
                        {Object.entries(catalog).map(([id, name]) => (
                          <option key={id} value={id}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </>
              )}
              {['count', 'radius', 'intensity', 'target']
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
                        } as any
                      )[k]
                    }
                    <input
                      type={k === 'target' ? 'text' : 'number'}
                      step={k === 'intensity' ? '.1' : '1'}
                      value={fields[k]}
                      onChange={(e) =>
                        setFields({
                          ...fields,
                          [k]:
                            k === 'target'
                              ? e.target.value
                              : Number(e.target.value),
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
                      setFields({
                        ...fields,
                        containerId: e.target.value || undefined,
                      })
                    }
                  >
                    <option value="">En el suelo</option>
                    {doc.props
                      .filter((p: any) => p.type === 'chest')
                      .map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name ?? 'Baúl'} ({p.x}, {p.y})
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <button
                disabled={locked.includes(chosen.layer)}
                onClick={applyFields}
              >
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
                      Math.max(
                        ...roots.map(
                          (e: any) =>
                            e.x + (e.width ?? e.footprint?.width ?? 1),
                        ),
                      ) - Math.min(...roots.map((e: any) => e.x));
                    const commands = roots.map((e: any) => ({
                      type: 'duplicateObject',
                      id: e.id,
                      newId: uid(e.layer),
                      x: e.x + offset,
                      y: e.y,
                    }));
                    if (edit(commands))
                      setSelected(commands.map((c: any) => c.newId));
                  }}
                >
                  Duplicar
                </button>
                <button
                  onClick={() => {
                    edit(
                      selectionRoots(doc, selected).map((e: any) => ({
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
                      download(
                        `${chosen.id}-template.json`,
                        JSON.stringify(t, null, 2),
                      );
                    }}
                  >
                    Guardar plantilla
                  </button>
                  <h3>Estilos de aberturas</h3>
                  {chosen.walls
                    .filter((w: any) => ['door', 'window'].includes(w.type))
                    .map((w: any) => (
                      <label key={`${w.x},${w.y}`}>
                        {w.type === 'door' ? 'Puerta' : 'Ventana'} ({w.x}, {w.y}
                        )
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
                                style: e.target.value || null,
                              },
                            ])
                          }
                        >
                          <option value="">Del edificio</option>
                          {Object.entries(
                            w.type === 'door' ? DOOR_STYLES : WINDOW_STYLES,
                          ).map(([id, name]) => (
                            <option key={id} value={id}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  <h3>Puertas</h3>
                  {chosen.walls
                    .filter((w: any) => w.type === 'door')
                    .map((w: any) => (
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
                                  id: w.doorId,
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
                                  id: w.doorId,
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
            <p>
              Selecciona un elemento del mapa para editarlo. Usa Mayús para
              seleccionar varios.
            </p>
          )}
          <h2>Capas</h2>
          {['terrain', ...LAYERS].map((layer) => (
            <div className="editor-layer" key={layer}>
              <label>
                <input
                  type="checkbox"
                  checked={!hidden.includes(layer)}
                  onChange={() =>
                    setHidden((v) =>
                      v.includes(layer)
                        ? v.filter((x) => x !== layer)
                        : [...v, layer],
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
                    v.includes(layer)
                      ? v.filter((x) => x !== layer)
                      : [...v, layer],
                  )
                }
              >
                {locked.includes(layer) ? '🔒' : '🔓'}
              </button>
            </div>
          ))}
          <h2>Validación</h2>
          <p className={report.valid ? 'valid' : 'invalid'}>
            {report.valid
              ? 'Sin errores de estructura'
              : `${report.errors.length} errores`}
          </p>
          {[...report.errors, ...report.warnings].map(
            (s: string, i: number) => (
              <p className="editor-warning" key={i}>
                {s}
              </p>
            ),
          )}
        </aside>
      </div>
      <div className="editor-status" role="status" aria-live="polite">
        {notice}
      </div>
      <Dialog
        open={Boolean(exportFile)}
        onOpenChange={(open) => {
          if (!open) setExportFile(null);
        }}
      >
        <DialogContent className="editor-export-dialog">
          <DialogTitle>Exportar {exportFile?.name}</DialogTitle>
          <DialogDescription>
            Guarda el archivo para abrirlo en el editor o modificarlo con un
            script.
          </DialogDescription>
          <textarea
            aria-label="JSON del mapa"
            readOnly
            value={exportFile?.text ?? ''}
          />
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
            <button onClick={() => setExportFile(null)}>
              Cerrar exportación
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
