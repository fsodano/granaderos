import {weaponSpecification} from './weapon-definition.js';
// Pure HUD model for the tactical battle inspector and squad strip.
// Read-only descriptors plus action-object constructors; no game rules.
import {weaponFor, bladeFor, actionCosts, reloadPlan, hasFirearm, carriedWeight, carryCapacity, WEAPONS, BLADES} from './tactical.js';

const alive = u => u.hp > 0 && !u.routed && !u.unconscious;
const hasTrait = (u, id) => Array.isArray(u.traits) && u.traits.includes(id);
const shortName = u => u.nickname || String(u.name || '').split(' ').slice(-1)[0] || '';

export function levelFor(unit) {
  return Math.floor((unit.agility + unit.dexterity + unit.strength + unit.leadership + unit.wisdom + unit.marksmanship + unit.mechanical + unit.explosives + unit.medical + unit.maxHp) / 100);
}

export function rosterCells(players, selectedId) {
  const cells = players.slice(0, 6).map((unit, index) => {
    const fallen = unit.hp <= 0 || unit.routed || unit.unconscious;
    return {
      unit,
      portrait: unit.portrait ?? null,
      label: shortName(unit),
      hpPct: Math.max(0, Math.min(100, Math.round((100 * unit.hp) / unit.maxHp))),
      ap: unit.ap,
      energy: unit.energy,
      active: unit.id === selectedId,
      fallen,
      disabled: fallen,
      index,
    };
  });
  while (cells.length < 6) cells.push({empty: true});
  return cells;
}

export function slotAction(unit) {
  return {type: 'weapon', slot: unit.activeSlot === 'blade' ? 'primary' : 'blade'};
}

export function backpackEquipAction(key, slot) {
  return {type: 'equipLoot', inventoryKey: key, slot};
}

export function inventoryModel(state, unit) {
  const stats = [
    {id: 'agility', label: 'Agilidad', value: unit.agility},
    {id: 'dexterity', label: 'Destreza', value: unit.dexterity},
    {id: 'strength', label: 'Fuerza', value: unit.strength},
    {id: 'leadership', label: 'Liderazgo', value: unit.leadership},
    {id: 'wisdom', label: 'Sabiduría', value: unit.wisdom},
    {id: 'level', label: 'Nivel', value: levelFor(unit)},
    {id: 'marksmanship', label: 'Puntería', value: unit.marksmanship},
    {id: 'explosives', label: 'Pólvora y artillería', value: unit.explosives},
    {id: 'mechanical', label: 'Mecánica', value: unit.mechanical},
    {id: 'medical', label: 'Medicina', value: unit.medical},
  ];
  const supplies = [
    {id: 'ammo', label: 'Cartuchos', count: unit.ammo},
    {id: 'priming', label: 'Cebado', count: unit.priming},
    {id: 'flints', label: 'Sílex', count: unit.flints},
    {id: 'rations', label: 'Raciones', count: unit.rations},
    {id: 'boleadoras', label: 'Boleadoras', count: unit.boleadoras},
    {id: 'torches', label: 'Antorchas', count: unit.torches},
  ];
  const backpack = Object.entries(unit.inventory || {})
    .filter(([, record]) => record && typeof record === 'object')
    .map(([key, record]) => {
      const weapon = weaponSpecification(record);
      const blade = BLADES[record.weapon];
      return {
        key,
        ...record,
        equippable: Boolean(weapon || blade),
        name: weapon?.name ?? blade?.name ?? null,
        art: weapon?.art ?? (blade?`/art/weapon-${blade.id}.png`:null),
      };
    });
  return {
    stats,
    slots: {primary: weaponFor({...unit,activeSlot:"primary"}), blade: bladeFor({...unit,activeSlot:'blade'})},
    activeSlot: unit.activeSlot,
    weight: carriedWeight(unit),
    capacity: carryCapacity(unit),
    poncho: Boolean(unit.poncho),
    supplies,
    backpack,
    unitAlive: alive(unit),
  };
}

const ORDER_DEFS = [
  {id: 'move', label: 'Mover', kind: 'mode'},
  {id: 'fire', label: 'Disparar', kind: 'mode'},
  {id: 'melee', label: 'Atacar', kind: 'mode'},
  {id: 'charge', label: 'Cargar', kind: 'mode'},
  {id: 'heal', label: 'Vendar', kind: 'mode'},
  {id: 'loot', label: 'Recoger equipo', kind: 'mode'},
  {id: 'reload', label: 'Recargar', kind: 'order'},
  {id: 'reprime', label: 'Cebar', kind: 'order'},
  {id: 'weapon', label: 'Cambiar arma', kind: 'order'},
  {id: 'stance', label: 'Postura', kind: 'order'},
  {id: 'overwatch', label: 'Cubrir', kind: 'order'},
  {id: 'mount', label: 'Montar', kind: 'order'},
  {id: 'brace', label: 'Calar bayoneta', kind: 'order'},
  {id: 'repair', label: 'Cambiar sílex', kind: 'order'},
  {id: 'ration', label: 'Tasajo y vendas', kind: 'order'},
  {id: 'torch', label: 'Arrojar antorcha', kind: 'mode'},
  {id: 'bolas', label: 'Lanzar boleadoras', kind: 'mode'},
  {id: 'free', label: 'Liberarse', kind: 'order'},
  {id: 'sight', label: 'Campo de visión', kind: 'toggle'},
  {id: 'endTurn', label: 'Fin del turno', kind: 'order'},
  {id: 'artillery', label: 'Disparar cañón', kind: 'mode'},
  {id: 'artilleryMove', label: 'Desplazar pieza', kind: 'mode'},
  {id: 'artilleryPivot', label: 'Girar pieza', kind: 'mode'},
  {id: 'artilleryReload', label: 'Recargar pieza', kind: 'order'},
];

export function orderDescriptors(state, unit, ctx = {}) {
  const u = unit || {};
  const unitAlive = Boolean(unit) && alive(u);
  const busy = Boolean(ctx.busy);
  const statusActive = state.status === 'active';
  const baseDisabled = !unitAlive || busy || !statusActive;
  const firearm = hasFirearm(u);
  const blade = bladeFor(u);
  const loading=reloadPlan(u,state);
  const hasGun = (state.artillery || []).some(g => g.side === 'player');
  const cannonSelected = Boolean(ctx.cannonId);

  const disabled = {
    move: false,
    fire: !firearm,
    melee: false,
    charge: false,
    heal: false,
    loot: false,
    reload: !firearm || u.jammed || !loading.pa,
    reprime: !firearm,
    weapon: false,
    stance: false,
    overwatch: !firearm,
    mount: !u.horse,
    brace: blade.id !== 1811 || u.ap < blade.ap,
    repair: !firearm || (u.flints ?? 4) < 1,
    ration: (u.rations ?? 2) < 1,
    torch: (u.torches ?? 2) < 1,
    bolas: (u.boleadoras ?? 0) < 1,
    free: !u.entangled,
    sight: false,
    endTurn: false,
    artillery: !hasGun || !cannonSelected,
    artilleryMove: !hasGun || !cannonSelected,
    artilleryPivot: !hasGun || !cannonSelected,
    artilleryReload: !hasGun || !cannonSelected,
  };

  const costs=actionCosts(state,u);
  const pa = {
    fire: costs.fire,
    melee: costs.melee,
    reload: state.mode==='exploration'?0:loading.pa,
    reprime: hasTrait(u, 'gunsmith_artillerist') ? 10 : 15,
    repair: hasTrait(u, 'gunsmith_artillerist') ? 18 : 25,
    brace: blade.ap,
    ration: 10,
    torch: 10,
    bolas: 12,
    free: 15,
    weapon: 4,
    stance: u.knockedDown ? 12 : 6,
    mount: hasTrait(u, 'cavalry_commander') ? 8 : 12,
    heal: costs.heal,
  };

  const active = {
    overwatch: Boolean(u.overwatch),
    brace: Boolean(u.braced),
    stance: u.stance === 'prone',
  };

  return ORDER_DEFS.map(def => {
    const d = {id: def.id, label: def.label, kind: def.kind, disabled: baseDisabled || disabled[def.id]};
    if (def.id in pa) d.pa = pa[def.id];
    if (def.id in active) d.active = active[def.id];
    if(def.id==='reload'){if(state.mode==='exploration')d.seconds=loading.pa?Math.max(1,Math.ceil(loading.pa*.06)):0;d.detail=loading.partial?`${loading.rounds} cartuchos; después faltan ${loading.remainingPA} PA.`:`${loading.rounds} cartuchos; recarga completa.`;}
    return d;
  });
}

export function orderAction(state, unit, ctx = {}, id) {
  switch (id) {
    case 'movement':
      return {type: 'movement', movement: ctx.movement};
    case 'reload':
    case 'reprime':
    case 'overwatch':
    case 'mount':
    case 'brace':
    case 'repair':
    case 'ration':
    case 'free':
      return {type: id};
    case 'weapon':
      return slotAction(unit);
    case 'stance':
      return {type: 'stance', stance: unit.stance === 'prone' ? 'standing' : 'prone'};
    case 'equipLoot':
      return {type: 'equipLoot', inventoryKey: ctx.inventoryKey, slot: ctx.slot};
    case 'torch':
      return {type: 'throwTorch', x: ctx.x, y: ctx.y};
    case 'bolas':
      return {type: 'boleadoras', targetId: ctx.targetId};
    case 'artillery':
      return {type: 'artillery', artilleryId: ctx.artilleryId, x: ctx.x, y: ctx.y, targetId: ctx.targetId, mode: ctx.mode};
    case 'artilleryMove':
    case 'artilleryPivot':
      return {type: id, artilleryId: ctx.artilleryId, x: ctx.x, y: ctx.y};
    case 'artilleryReload':
      return {type: 'artilleryReload', artilleryId: ctx.artilleryId};
    case 'endTurn':
      return {type: 'rest'};
    case 'move':
      return {type: 'move', x: ctx.x, y: ctx.y};
    case 'fire':
      return {type: 'fire', targetId: ctx.targetId};
    case 'melee':
      return {type: 'melee', targetId: ctx.targetId};
    case 'charge':
      return {type: 'charge', targetId: ctx.targetId};
    case 'heal':
      return {type: 'heal', targetId: ctx.targetId};
    case 'loot':
      return {type: 'loot', targetId: ctx.targetId};
    default:
      return {type: id};
  }
}