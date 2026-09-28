'use client';
import {storyReferences} from '../../../game/campaign-story.js';
import DialogueEditor from './DialogueEditor';
import QuestEditor from './QuestEditor';
import CampaignRules from './CampaignRules';
import { useEffect, useRef, useState } from 'react';
import {
  ATTRIBUTE_FIELDS,
  CONTENT_SECTORS,
  FIREARM_TEMPLATES,
  BLADE_TEMPLATES,
  CONTENT_LIMIT,
  defaultContentPackage,
  validateContentPackage,
  parseContentPackage,
  encodeContentPackage,
} from '../../../game/content-package.js';
import {
  createContentSession,
  advanceContentSession,
  setContentPersonStatus,
  encodeContentSession,
  decodeContentSession,
} from '../../../game/content-placement.js';
import { createContentTestRange,contentShotPreview } from '../../../game/content-test-range.js';
import { actBattle, endTurn, weaponFor } from '../../../game/tactical.js';
import { initialCampaign } from '../../../game/campaign.js';
import { encodeSave } from '../../../game/save.js';
import { campaignContentReport } from '../../../game/campaign-content.js';
import { CONTENT_LAUNCH_KEY } from '../../../game/content-launch.js';
import './editor.css';
import {CHARACTER_ABILITIES,legacyCharacterAbilities} from '../../../game/character-abilities.js';
import {isContractCharacter,isHistoricalCharacter,isWorldCharacter,legacyOperativeId} from '../../../game/content-character-ids.js';
import CharacterPresentation from './CharacterPresentation';
import {SPEECH_EVENTS} from '../../../game/characters.js';
import {characterPresentationDefaults} from '../../../game/content-character-presentation.js';
import {CONTENT_TRAITS} from '../../../game/content-character-options.js';
import {FIREARM_PRICES,BLADE_PRICES,isBladeDefinition} from '../../../game/weapon-definition.js';
import {WEAPONS as BASE_FIREARMS} from '../../../game/firearm-definitions.js';
import {WEAPONS as BASE_ITEMS} from '../../../game/data.js';
import {CAMPAIGN_SECTORS} from '../../../game/data.js';
import PlacementMap from './PlacementMap';
import ArrivalSites from './ArrivalSites';
import ForceEquipment from './ForceEquipment';
import {forceWeaponUsers} from '../../../game/content-force-equipment.js';
const DRAFT_KEY = 'granaderos.content-draft.v1';
const labels: Record<string, string> = {
  maxHp: 'Salud',
  agility: 'Agilidad',
  dexterity: 'Destreza',
  strength: 'Fuerza',
  leadership: 'Liderazgo',
  wisdom: 'Sabiduría',
  marksmanship: 'Puntería',
  mechanical: 'Mecánica',
  explosives: 'Explosivos',
  medical: 'Medicina',
  damage: 'Daño',
  ap: 'PA de ataque',
  reach: 'Alcance cuerpo a cuerpo',
  fireAP: 'PA de disparo',
  aimAP: 'PA por nivel de puntería',
  reloadAP: 'PA de recarga completa',
  range: 'Alcance',
  readyAP: 'PA para levantar el arma',
  capacity: 'Capacidad de carga',
  weight: 'Peso (kg)',
  price: 'Precio (pesos)',
};
const clock = (minute: number) =>
  `Día ${Math.floor(minute / 1440) + 1} · ${String(Math.floor((minute % 1440) / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function nextId(prefix: string, items: any[]) {
  let n = 1;
  while (items.some((i) => i.id === `${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}
export default function ContentEditor() {
  const [draft, setDraft] = useState<any>(() => defaultContentPackage());
  const [past, setPast] = useState<any[]>([]);
  const [future, setFuture] = useState<any[]>([]);
  const [tab, setTab] = useState('characters');
  const [selected, setSelected] = useState('person-0');
  const [searches, setSearches] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [battle, setBattle] = useState<any>(null);
  const [seed, setSeed] = useState(18130203);
  const [loaded, setLoaded] = useState('');
  const testImportRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const portraitRef = useRef<HTMLInputElement>(null);
  const weaponArtRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = parseContentPackage(saved);
        setDraft(parsed);
        setSelected(parsed.characters[0]?.id ?? '');
      }
    } catch {
      setNotice('No se pudo recuperar el borrador. El archivo original se conserva hasta que hagas un cambio o importes una copia.');
      return;
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      const text = JSON.stringify(draft);
      if (new TextEncoder().encode(text).length > CONTENT_LIMIT) throw Error();
      localStorage.setItem(DRAFT_KEY, text);
    } catch {
      setNotice(
        'No se pudo guardar el borrador. Exportá una copia antes de salir.',
      );
    }
  }, [draft, ready]);
  const errors = validateContentPackage(draft);
  const integration = errors.length ? null : campaignContentReport(draft);
  const collection = tab === 'weapons' ? 'weapons' : 'characters';
  const items = draft[collection];
  const searchable = tab === 'characters' || tab === 'weapons';
  const search = searches[collection] ?? '';
  const normalizeSearch = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase();
  const query = normalizeSearch(search.trim());
  const visibleItems =
    searchable && query
      ? items.filter((entry: any) =>
          normalizeSearch(
            [entry.name, entry.nickname, entry.id].filter(Boolean).join(' '),
          ).includes(query),
        )
      : items;
  const item = items.find((i: any) => i.id === selected) ?? items[0];
  const contractDefaults = tab==='characters' ? defaultContentPackage().characters.find(c=>c.id===item?.id) : null;
  const characterTraits = item?.traits??contractDefaults?.traits??[];
  const ridingSkill = item?.ridingSkill??contractDefaults?.ridingSkill??0;
  const placement = draft.placements.find((p: any) => p.character === item?.id);
  function change(next: any) {
    setReady(true);
    setPast((p) => [...p.slice(-29), draft]);
    setFuture([]);
    setDraft(next);
    setSession(null);
    setBattle(null);
  }
  function update(patch: any) {
    change({
      ...draft,
      [collection]: items.map((i: any) =>
        i.id === item.id ? { ...i, ...patch } : i,
      ),
    });
  }
  function updatePlacement(patch: any) {
    const next={...placement,...patch};
    if(next.selection==='alternate'&&(next.mode!=='daily'||next.sectors.length!==2))patch={...patch,selection:'random'};
    change({
      ...draft,
      placements: draft.placements.map((p: any) =>
        p.id === placement.id ? { ...p, ...patch } : p,
      ),
    });
  }
  function addPlacement() {
    change({
      ...draft,
      placements: [
        ...draft.placements,
        {
          id: nextId('placement', draft.placements),
          character: item.id,
          mode: 'fixed',
          sectors: ['retiro'],
          moveChance: 100,
          afterDeath: null,
          delayMin: 0,
          delayMax: 0,
        },
      ],
    });
  }
  function undo() {
    if (!past.length) return;
    setFuture((f) => [draft, ...f]);
    setDraft(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setSession(null);
    setBattle(null);
  }
  function redo() {
    if (!future.length) return;
    setPast((p) => [...p, draft]);
    setDraft(future[0]);
    setFuture((f) => f.slice(1));
    setSession(null);
    setBattle(null);
  }
  function safely(action: () => void) {
    try {
      action();
    } catch (e: any) {
      setNotice(e.message);
    }
  }
  function add(kind='contract') {
    let added: any;
    if (collection === 'characters')
      added = {
        ...structuredClone(defaultContentPackage().characters.find(isContractCharacter)!),
        id: nextId('person', draft.characters),
        name: 'Nuevo personaje',
        nickname: 'Nuevo',
        role: '',
        biography: '',
        traits: [],
        ridingSkill: 0,
        abilities: [],
        personality: '',
        speech: Object.fromEntries(SPEECH_EVENTS.map(event=>[event,''])),
        spriteAppearance: 'granadero',
        weapon: draft.weapons[0]?.id ?? null,
        blade: draft.weapons.find(isBladeDefinition)?.id,
      };
    else if (collection === 'weapons')
      added = {
        ...structuredClone(defaultContentPackage().weapons.find(w=>isBladeDefinition(w)===(kind==='blade'))!),
        id: nextId(kind==='blade'?'blade':'firearm', draft.weapons),
        name: 'Nueva arma',
      };
    if(collection==='characters'&&kind==='encounter'){
      delete added.arrivalHours;
      Object.assign(added,{name:'Nuevo habitante',nickname:'Habitante',role:'Habitante',recruitmentSource:'encounter',service:'permanent',monthlyPay:0,weapon:null,spriteAppearance:'worker',encounter:{recruitable:false,greeting:'Buen día.',requiredLeadership:0,requiredLiberated:0,requiredSector:null}});
    }
    change({ ...draft, [collection]: [...items, added] });
    setSelected(added.id);
    setSearches((current) => ({ ...current, [collection]: '' }));
  }
  function duplicateCharacter() {
    if (collection !== 'characters' || isHistoricalCharacter(item)) return;
    const added = {...structuredClone(item), ...structuredClone(characterPresentationDefaults(item)), abilities:[...(item.abilities??legacyCharacterAbilities(legacyOperativeId(item.id)))], recruitmentSource:item.recruitmentSource??'contract', service:item.service??'contract', progression:item.progression??'experience', traits:[...characterTraits], ridingSkill, id: nextId('person', draft.characters), name: `${item.name.slice(0, 92)} (copia)`};
    change({...draft, characters: [...draft.characters, added],placements:placement?[...draft.placements,{...structuredClone(placement),id:nextId('placement',draft.placements),character:added.id}]:draft.placements});
    setSelected(added.id);
    setSearches(current=>({...current,characters:''}));
  }
  function remove() {
    if(collection==='characters'&&isHistoricalCharacter(item)){setNotice('Los mandos históricos todavía tienen funciones de campaña. No se pueden eliminar hasta separar esas funciones.');return;}
    if(collection==='weapons'&&forceWeaponUsers(draft,item.id).length){setNotice('Asigná otra arma a las tropas que la usan.');return;}

    if (
      collection === 'characters' &&
      (storyReferences(draft.campaignStory,'character',item.id)||(draft.quests??[]).some((q:any)=>q.requiredAlive?.includes(item.id))||draft.placements.some((p:any)=>p.afterDeath===item.id)||draft.characters.some((owner:any)=>owner.id!==item.id&&owner.encounter?.dialogue?.nodes.some((n:any)=>n.choices.some((choice:any)=>choice.conditions?.some((c:any)=>['character','meeting'].includes(c.type)&&c.character===item.id)||choice.effects?.some((e:any)=>e.type==='movement'&&e.character===item.id)))))
    ) {
      setNotice(
        'Quitá primero las apariciones y condiciones, los movimientos y los encargos que usan este personaje.',
      );
      return;
    }
    if (
      collection === 'weapons' &&
      draft.characters.some((c: any) => c.weapon === item.id || c.blade === item.id)
    ) {
      setNotice('Asigná otra arma a los personajes que la usan.');
      return;
    }
    change({
      ...draft,
      [collection]: items.filter((i: any) => i.id !== item.id),
      placements: collection==='characters'?draft.placements.filter((p:any)=>p.character!==item.id):draft.placements,
    });
    setSelected('');
    setSearches(current=>({...current,[collection]:''}));
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > CONTENT_LIMIT) throw Error('El archivo supera 2 MB.');
      const value = parseContentPackage(await file.text());
      change(value);
      setSelected(value.characters[0]?.id ?? '');
      setNotice(
        'Contenido importado. Podés deshacer para volver al borrador anterior.',
      );
    } catch (e: any) {
      setNotice(e.message);
    }
  }
  async function uploadImage(file: File | undefined, collection: 'characters' | 'weapons', field: 'portrait' | 'art') {
    if (!file || !item) return;
    const target = item.id;
    try {
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 250000
      )
        throw Error('Usá una imagen PNG, JPEG o WebP de hasta 250 KB.');
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      change({
        ...draft,
        [collection]: draft[collection].map((c: any) =>
          c.id === target ? { ...c, [field]: data } : c,
        ),
      });
    } catch (e: any) {
      setNotice(e.message || 'No se pudo leer la imagen.');
    }
  }
  function numeric(key: string, value: number, attributes = false) {
    return (
      <label key={key}>
        {labels[key] ?? key}
        <input
          type="number"
          value={Number.isFinite(value) ? value : ''}
          min={key === 'maxHp' ? 15 : 0}
          max={key === 'reloadAP' ? 500 : key === 'price' ? 1000000 : key === 'weight' ? 30 : key === 'capacity' ? 8 : key==='reach'?4:100}
          step={['weight','reach'].includes(key) ? .1 : 1}
          onChange={(e) =>
            update(
              attributes
                ? {
                    attributes: {
                      ...item.attributes,
                      [key]: e.target.valueAsNumber,
                    },
                  }
                : { [key]: e.target.valueAsNumber },
            )
          }
        />
      </label>
    );
  }
  const player = battle?.units.find((u: any) => u.side === 'player');
  const target = battle?.units.find((u: any) => u.side === 'enemy');
  const shot =
    player && target
      ? contentShotPreview(battle,player,target)
      : null;
  return (
    <main className="content-editor">
      <header>
        <div>
          <a href="/">← Volver al juego</a> · <a href="/editor">Editar sectores</a>
          <p className="eyebrow">Taller de campañas</p>
          <h1>El mundo y sus protagonistas</h1>
          <p>Editá el contenido. Probá sus reglas en una sesión separada.</p>
        </div>
        <div className="toolbar">
          <button disabled={!past.length} onClick={undo}>
            Deshacer
          </button>
          <button disabled={!future.length} onClick={redo}>
            Rehacer
          </button>
          <button onClick={() => importRef.current?.click()}>Importar</button>
          <button
            disabled={!!errors.length}
            onClick={() =>
              safely(() =>
                download(encodeContentPackage(draft), `${draft.id}.json`),
              )
            }
          >
            Exportar contenido
          </button>
        </div>
      </header>
      <input
        ref={testImportRef}
        hidden
        type="file"
        accept="application/json,.json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            if (file.size > CONTENT_LIMIT)
              throw Error('El archivo supera 2 MB.');
            const restored = decodeContentSession(await file.text());
            change(restored.content);
            setSession(restored);
            setNotice('Prueba recuperada, con su contenido y sus decisiones.');
          } catch (e: any) {
            setNotice(e.message);
          }
        }}
      />
      <input
        ref={importRef}
        hidden
        type="file"
        accept="application/json,.json"
        onChange={(e) => {
          void importFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={portraitRef}
        hidden
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          void uploadImage(e.target.files?.[0], 'characters', 'portrait');
          e.target.value = '';
        }}
      />
      <input hidden ref={weaponArtRef} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Imagen del arma" onChange={e=>{void uploadImage(e.target.files?.[0],'weapons','art');e.target.value='';}}/>
      {notice && (
        <div role="status" className="notice">
          {notice}
          <button onClick={() => setNotice('')} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      )}
      <p className="scope-note">
        El borrador se guarda en este navegador. Las pruebas no modifican tu
        partida. Editá personajes, armas y apariciones. Podés iniciar una campaña
        separada con estas fichas.
      </p>
      <section className="campaign-launch" aria-label="Integración de campaña">
        <h2>Jugar con el contenido editado</h2>
        <p>
          Creá contratables y habitantes, elegí sus celdas y configurá sus fichas,
          encuentros y sucesores. También podés editar las armas de personajes,
          enemigos y milicias. La campaña conserva una copia de este contenido
          y se guarda por separado.
        </p>
        {integration && (
          <ul>
            {[...integration.blocked, ...integration.pending].map(
              (message: string) => (
                <li key={message}>{message}</li>
              ),
            )}
          </ul>
        )}
        <button
          className="primary"
          disabled={!ready || !integration || integration.blocked.length > 0}
          onClick={() =>
            safely(() => {
              const campaign = initialCampaign(seed, draft);
              sessionStorage.setItem(CONTENT_LAUNCH_KEY, encodeSave(campaign));
              window.location.assign('/?content=1&launch=1');
            })
          }
        >
          Iniciar campaña con estas fichas
        </button>{' '}
        <a href="/?content=1">Continuar campaña del editor</a>
      </section>
      <nav aria-label="Secciones del editor">
        {[
          ['characters', 'Personajes'],
          ['weapons', 'Armas'],
          ['arrivals', 'Llegadas'],
          ['rules', 'Reglas'],
          ['quests', 'Encargos'],
          ['test', 'Pruebas'],
        ].map(([id, name]) => (
          <button
            key={id}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => {
              setTab(id);
              setSelected('');
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      {tab === 'rules' ? <CampaignRules draft={draft} onChange={change}/> : tab === 'quests' ? <QuestEditor draft={draft} onChange={change}/> : tab === 'arrivals' ? <ArrivalSites draft={draft} onChange={change}/> : tab !== 'test' ? (
        <div className="editor-columns">
          <aside>
            <h2>
              {tab === 'characters'
                ? 'Personajes'
                : tab === 'weapons'
                  ? 'Armas'
                  : 'Apariciones'}{' '}
              <small>
                {query && searchable
                  ? `${visibleItems.length} / ${items.length}`
                  : items.length}
              </small>
            </h2>
            {tab==='characters'&&<button onClick={()=>add('encounter')}>Crear habitante</button>}
            {tab==='weapons'&&<button onClick={()=>add('blade')}>Crear arma blanca</button>}
            <button className="primary" onClick={()=>add()}>
              + Crear{' '}
              {tab === 'characters'
                ? 'personaje'
                : tab === 'weapons'
                  ? 'arma'
                  : 'aparición'}
            </button>
            {searchable && (
              <label className="list-search">
                {tab === 'characters' ? 'Buscar personajes' : 'Buscar armas'}
                <input
                  type="search"
                  value={search}
                  placeholder={
                    tab === 'characters' ? 'Nombre, apodo o ID' : 'Nombre o ID'
                  }
                  onChange={(e) =>
                    setSearches((current) => ({
                      ...current,
                      [collection]: e.target.value,
                    }))
                  }
                />
              </label>
            )}
            <div className="entry-list">
              {visibleItems.length === 0 && (
                <p role="status">No hay resultados para esta búsqueda.</p>
              )}
              {visibleItems.map((i: any) => (
                <button
                  key={i.id}
                  aria-pressed={i.id === item?.id}
                  onClick={() => {
                    setSelected(i.id);
                  }}
                >
                  {tab === 'weapons' && <img className="weapon-thumbnail" src={i.art??`/art/weapon-${i.template}.png`} alt=""/>}
                  {i.name ??
                    draft.characters.find((c: any) => c.id === i.character)
                      ?.name ??
                    i.id}
                  <small>{i.id}</small>
                </button>
              ))}
            </div>
          </aside>
          <section className="form-panel">
            {item ? (
              <>
                <div className="panel-heading">
                  <div>
                    <h2>{item.name ?? 'Regla de aparición'}</h2>
                    <code>{item.id}</code>
                  </div>
                  <div>
                    {tab==='characters'&&!isHistoricalCharacter(item)&&<button onClick={duplicateCharacter}>Duplicar personaje</button>}
                    <button onClick={remove}>Eliminar</button>
                  </div>
                </div>
                {tab === 'characters' && (
                  <>
                    <div className="identity">
                      <img
                        src={item.portrait}
                        alt={`Retrato de ${item.name}`}
                      />
                      <div>
                        <label>
                          Nombre
                          <input
                            value={item.name}
                            maxLength={100}
                            onChange={(e) => update({ name: e.target.value })}
                          />
                        </label>
                        <label>
                          Apodo
                          <input
                            value={item.nickname}
                            maxLength={100}
                            onChange={(e) =>
                              update({ nickname: e.target.value })
                            }
                          />
                        </label>
                        <button onClick={() => portraitRef.current?.click()}>
                          Cambiar retrato
                        </button>
                        <small>PNG, JPEG o WebP · hasta 250 KB</small>
                      </div>
                    </div>
                    <label>
                      Función
                      <input
                        value={item.role}
                        onChange={(e) => update({ role: e.target.value })}
                      />
                    </label>
                    <label>
                      Biografía
                      <textarea
                        rows={4}
                        value={item.biography}
                        onChange={(e) => update({ biography: e.target.value })}
                      />
                    </label>
                    <div className="fields">
                      <label>
                        Paga mensual
                        <input
                          type="number"
                          min={0}
                          max={1000000}
                          value={item.monthlyPay}
                          disabled={!isContractCharacter(item)&&!(isWorldCharacter(item)&&item.service==='contract')}
                          title={!isContractCharacter(item)&&item.service!=='contract' ? "Servicio permanente" : undefined}
                          onChange={(e) =>
                            update({ monthlyPay: e.target.valueAsNumber })
                          }
                        />
                      </label>
                      <label>
                        Arma principal
                        <select
                          value={item.weapon ?? ''}
                          onChange={(e) =>
                            update({ weapon: e.target.value || null })
                          }
                        >
                          <option value="">Sin arma principal</option>
                          {draft.weapons.map((w: any) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>Arma blanca
                        <select value={item.blade??''} onChange={e=>update({blade:e.target.value||undefined})}>
                          <option value="">Equipo original del personaje</option>
                          {draft.weapons.filter(isBladeDefinition).map((w:any)=><option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      </label>
                    </div>
                    {isContractCharacter(item) && <label>
                      Tiempo de viaje (horas)
                      <input type="number" min={0} max={168} value={item.arrivalHours ?? 0} onChange={e=>update({arrivalHours:e.target.valueAsNumber})}/>
                      <small>El contrato comienza al llegar. Con 0, la llegada es inmediata si el destino es seguro.</small>
                    </label>}
                    {!isHistoricalCharacter(item)&&<fieldset>
                      <legend>Formación y progreso</legend>
                      <label>Progreso por combate
                        <select value={item.progression??'experience'} onChange={e=>update({progression:e.target.value})}>
                          <option value="experience">Gana experiencia y niveles</option>
                          <option value="fixed">Conserva el nivel inicial</option>
                        </select>
                      </label>
                      <small>La instrucción de atributos sigue disponible con ambas opciones.</small>
                      <label>Equitación
                        <input type="number" min={0} max={100} value={ridingSkill} onChange={e=>update({ridingSkill:e.target.valueAsNumber})}/>
                        <small>Reduce el esfuerzo y el coste de moverse a caballo. Equitación experta asegura un mínimo de 80.</small>
                      </label>
                      <div className="fields">
                        {CONTENT_TRAITS.map(trait=><label key={trait.id}>
                          <input type="checkbox" checked={characterTraits.includes(trait.id)} onChange={e=>update({traits:e.target.checked?[...characterTraits,trait.id]:characterTraits.filter((id:string)=>id!==trait.id)})}/>
                          {trait.name}
                        </label>)}
                      </div>
                    </fieldset>}
                    {isWorldCharacter(item)&&<fieldset aria-label="Encuentro del habitante">
                      <legend>Encuentro</legend>
                      <label>Saludo al conversar
                        <textarea rows={3} maxLength={1000} value={item.encounter.greeting} onChange={e=>update({encounter:{...item.encounter,greeting:e.target.value}})}/>
                      </label>
                      <label><input type="checkbox" checked={item.encounter.recruitable} onChange={e=>update({encounter:{...item.encounter,recruitable:e.target.checked}})}/>Puede incorporarse a la escuadra</label>
                      {item.encounter.recruitable&&<>
                        <label>Tipo de servicio
                          <select value={item.service} onChange={e=>update({service:e.target.value,...(e.target.value==='permanent'?{monthlyPay:0}:{})})}>
                            <option value="permanent">Permanente, sin paga</option>
                            <option value="contract">Contrato diario, semanal o mensual</option>
                          </select>
                        </label>
                        <p>Se incorpora donde lo encontrás y conserva sus heridas. {item.service==='contract'?'La paga mensual define el precio de cada plazo. El jugador elige y paga antes de incorporarlo.':'Sirve sin paga y sin fecha de vencimiento.'}</p>
                        {item.service==='contract'&&<small>Precio inicial: {Math.ceil(item.monthlyPay/30)} pesos por día, {Math.ceil(item.monthlyPay/30)*7} por semana y {Math.ceil(item.monthlyPay/30)*30} por mes. El día se redondea hacia arriba; la experiencia puede aumentar el precio futuro.</small>}
                        <label>Liderazgo mínimo del interlocutor
                          <input type="number" min={0} max={100} value={item.encounter.requiredLeadership} onChange={e=>update({encounter:{...item.encounter,requiredLeadership:e.target.valueAsNumber}})}/>
                        </label>
                        <label>Localidades seguras necesarias
                          <input type="number" min={0} max={12} value={item.encounter.requiredLiberated} onChange={e=>update({encounter:{...item.encounter,requiredLiberated:e.target.valueAsNumber}})}/>
                        </label>
                        <label>Localidad que debe estar liberada
                          <select value={item.encounter.requiredSector??''} onChange={e=>update({encounter:{...item.encounter,requiredSector:e.target.value||null}})}>
                            <option value="">Ninguna</option>
                            {CAMPAIGN_SECTORS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </label>
                      </>}
                    </fieldset>}
                    {isWorldCharacter(item)&&<DialogueEditor key={item.id} ownerId={item.id} characters={draft.characters} quests={draft.quests??[]} value={item.encounter.dialogue} greeting={item.encounter.greeting} onChange={dialogue=>update({encounter:{...item.encounter,dialogue}})}/>}
                    <fieldset aria-label="Habilidades de combate">
                      <legend>Habilidades de combate</legend>
                      <p>Elegí las capacidades de este personaje. Sin casillas marcadas, no tendrá ninguna de estas ventajas. Las funciones de historia se conservan por ahora.</p>
                      <div className="fields">
                        {CHARACTER_ABILITIES.map(ability=>{
                          const abilities=item.abilities??legacyCharacterAbilities(legacyOperativeId(item.id));
                          return <label key={ability.id}>
                            <input type="checkbox" checked={abilities.includes(ability.id)} onChange={e=>update({abilities:e.target.checked?[...abilities,ability.id]:abilities.filter((id:string)=>id!==ability.id)})}/>
                            {ability.name}<small>{ability.description}</small>
                          </label>;
                        })}
                      </div>
                    </fieldset>
                    <CharacterPresentation character={item} portraits={defaultContentPackage().characters} weapon={draft.weapons.find((w:any)=>w.id===item.weapon)?.template??0} onChange={update}/>
                    <h3>Atributos</h3>
                    <div className="fields">
                      {ATTRIBUTE_FIELDS.map((k) =>
                        numeric(k, item.attributes[k], true),
                      )}
                    </div>
                  </>
                )}
                {tab === 'weapons' && (
                  <>
                    <img className="weapon-preview" src={item.art??`/art/weapon-${item.template}.png`} alt={item.name}/>
                    <button onClick={()=>weaponArtRef.current?.click()}>Cambiar imagen del arma</button>
                    <button disabled={!item.art} onClick={()=>update({art:undefined})}>Usar imagen de la familia</button>
                    <small>PNG, JPEG o WebP · hasta 250 KB</small>
                    <label>
                      Nombre
                      <input
                        value={item.name}
                        onChange={(e) => update({ name: e.target.value })}
                      />
                    </label>
                    <label>
                      Familia de funcionamiento
                      <select
                        value={item.template}
                        onChange={(e) =>
                          update({ template: Number(e.target.value) })
                        }
                      >
                        {(isBladeDefinition(item)?BLADE_TEMPLATES:FIREARM_TEMPLATES).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p>
                      La familia conserva sus técnicas de combate. El nombre, la imagen y estos valores se usan en la campaña, la armería y el equipo recuperado. La prueba de tiro admite armas de fuego.
                    </p>
                    <div className="fields">
                      {(isBladeDefinition(item)?['damage','ap','reach']:[
                        'damage',
                        'fireAP',
                        'aimAP',
                        'reloadAP',
                        'range',
                      ]).map((k) => numeric(k, item[k]))}
                      {!isBladeDefinition(item)&&numeric('capacity',item.capacity??BASE_FIREARMS[item.template]?.capacity)}
                      {numeric('weight',item.weight??(BASE_ITEMS as any)[item.template]?.weight)}
                      {numeric('price',item.price??({...FIREARM_PRICES,...BLADE_PRICES} as any)[item.template])}
                    </div>
                  </>
                )}
                {tab === 'characters' && isContractCharacter(item) && <p>Se contrata desde el boletín. No aparece en el mapa antes de contratarlo.</p>}
                {tab === 'characters' && !(isContractCharacter(item)) && (
                  <section aria-label="Aparición del personaje">
                    <h3>Aparición y recorridos</h3>
                    {placement ? (
                      <>
                        <button
                          onClick={() =>
                            change({
                              ...draft,
                              placements: draft.placements.filter(
                                (p: any) => p.id !== placement.id,
                              ),
                            })
                          }
                        >
                          Quitar aparición
                        </button>
                        <label>
                          Ubicación
                          <select
                            value={placement.mode}
                            onChange={(e) =>
                              updatePlacement({
                                mode: e.target.value,
                                sectors:
                                  e.target.value === 'fixed'
                                    ? placement.sectors.slice(0, 1)
                                    : placement.sectors,
                              })
                            }
                          >
                            <option value="fixed">Sector fijo</option>
                            <option value="once">
                              Sorteo al inicio; ubicación definitiva
                            </option>
                            <option value="daily">
                              Puede cambiar cada día a las 04:00
                            </option>
                          </select>
                        </label>
                        <PlacementMap
                          selected={placement.sectors}
                          onChange={(sectors) =>
                            updatePlacement({
                              sectors,
                              mode:
                                placement.mode === 'fixed' && sectors.length > 1
                                  ? 'once'
                                  : placement.mode,
                            })
                          }
                        />
                        <details>
                          <summary>
                            Ver todos los sectores seleccionados (
                            {placement.sectors.length})
                          </summary>
                          <ul>
                            {placement.sectors.map((id: string) => (
                              <li key={id}>
                                {CONTENT_SECTORS.find((s) => s.id === id)
                                  ?.name ?? id}{' '}
                                <button
                                  aria-label={`Quitar ${CONTENT_SECTORS.find((s) => s.id === id)?.name ?? id}`}
                                  onClick={() =>
                                    updatePlacement({
                                      sectors: placement.sectors.filter(
                                        (selectedId: string) =>
                                          selectedId !== id,
                                      ),
                                    })
                                  }
                                >
                                  Quitar
                                </button>
                              </li>
                            ))}
                          </ul>
                        </details>
                        {placement.mode === 'daily' && <>
                          <label>Probabilidad diaria de elegir ubicación (%)
                            <input type="number" min={0} max={100} value={placement.moveChance} onChange={e=>updatePlacement({moveChance:e.target.valueAsNumber})}/>
                          </label>
                          <label>Elección diaria
                            <select value={placement.selection??'random'} onChange={e=>updatePlacement({selection:e.target.value})}>
                              <option value="random">Sortear entre las celdas marcadas</option>
                              <option value="alternate" disabled={placement.sectors.length!==2}>Alternar entre dos celdas</option>
                            </select>
                          </label>
                          <label>Protección mientras hay una escena abierta
                            <select value={placement.loadedGuard??'current'} onChange={e=>updatePlacement({loadedGuard:e.target.value})}>
                              <option value="current">No salir de la celda abierta ni entrar en ella</option>
                              <option value="range">No trasladarse si alguna celda del rango está abierta</option>
                            </select>
                          </label>
                        </>}
                        <p>
                          Un sorteo puede conservar el sector actual. Los
                          muertos y reclutados no se trasladan. El sector
                          abierto queda protegido.
                        </p>
                        <label>
                          Aparece después de la muerte de{!isWorldCharacter(item)&&' (solo simulación)'}
                          <select
                            value={placement.afterDeath ?? ''}
                            onChange={(e) =>
                              updatePlacement({
                                afterDeath: e.target.value || null,
                              })
                            }
                          >
                            <option value="">
                              Nadie: disponible desde el inicio
                            </option>
                            {draft.characters
                              .filter((c: any) => c.id !== placement.character)
                              .map((c: any) => (
                                <option value={c.id} key={c.id}>
                                  {c.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        {placement.afterDeath&&<p>La muerte confirmada activa a este personaje una sola vez. Llega con su propia salud. Esta regla solo activa su aparición. Si la celda de llegada está abierta, espera hasta que salgas.</p>}
                        {placement.afterDeath && (
                          <div className="fields">
                            <label>
                              Demora mínima (minutos)
                              <input
                                type="number"
                                min={0}
                                value={placement.delayMin}
                                onChange={(e) =>
                                  updatePlacement({
                                    delayMin: e.target.valueAsNumber,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Demora máxima (minutos)
                              <input
                                type="number"
                                min={placement.delayMin}
                                value={placement.delayMax}
                                onChange={(e) =>
                                  updatePlacement({
                                    delayMax: e.target.valueAsNumber,
                                  })
                                }
                              />
                            </label>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p>Este personaje no tiene una aparición en el mapa.</p>
                        <button onClick={addPlacement}>
                          Configurar aparición
                        </button>
                      </>
                    )}
                  </section>
                )}
              </>
            ) : (
              <p>Creá un registro para comenzar.</p>
            )}
            {tab==='weapons'&&<ForceEquipment draft={draft} onChange={change}/>}
          </section>
        </div>
      ) : (
        <section className="test-panel">
          <h2>Probar el borrador</h2>
          <div className="fields">
            <label>
              Semilla de la campaña
              <input
                type="number"
                min={0}
                max={4294967295}
                value={seed}
                onChange={(e) => setSeed(e.target.valueAsNumber)}
              />
            </label>
            <label>
              Sector abierto durante el avance
              <select
                value={loaded}
                onChange={(e) => setLoaded(e.target.value)}
              >
                <option value="">Ninguno</option>
                {CONTENT_SECTORS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="primary"
            disabled={!!errors.length}
            onClick={() =>
              safely(() => {
                setSession(createContentSession(draft, seed));
                setBattle(null);
              })
            }
          >
            Iniciar prueba de apariciones
          </button>{' '}
          <button onClick={() => testImportRef.current?.click()}>
            Cargar prueba
          </button>{' '}
          {session && (
            <button
              onClick={() =>
                safely(() =>
                  download(
                    encodeContentSession(session),
                    'prueba-apariciones.json',
                  ),
                )
              }
            >
              Guardar prueba
            </button>
          )}
          {session && (
            <>
              <div className="panel-heading">
                <h3>{clock(session.minute)}</h3>
                <div className="toolbar">
                  <button
                    onClick={() =>
                      safely(() =>
                        setSession(
                          advanceContentSession(
                            session,
                            session.minute + 60,
                            loaded || null,
                          ),
                        ),
                      )
                    }
                  >
                    Avanzar 1 hora
                  </button>
                  <button
                    onClick={() =>
                      safely(() =>
                        setSession(
                          advanceContentSession(
                            session,
                            session.nextDaily,
                            loaded || null,
                          ),
                        ),
                      )
                    }
                  >
                    Siguiente 04:00
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Personaje</th>
                      <th>Sector</th>
                      <th>Estado</th>
                      <th>Simular evento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.characters.map((c: any) => {
                      const s = session.people[c.id];
                      return (
                        <tr key={c.id}>
                          <td>{c.name}</td>
                          <td>
                            {CONTENT_SECTORS.find((d) => d.id === s.sector)
                              ?.name ?? '—'}
                          </td>
                          <td>
                            {!s.alive
                              ? 'Muerto'
                              : s.recruited
                                ? 'Reclutado'
                                : s.appeared
                                  ? 'Presente'
                                  : 'Pendiente'}
                          </td>
                          <td>
                            <button
                              disabled={!s.alive}
                              onClick={() =>
                                safely(() =>
                                  setSession(
                                    setContentPersonStatus(
                                      session,
                                      c.id,
                                      'dead',
                                    ),
                                  ),
                                )
                              }
                            >
                              Muerte
                            </button>
                            <button
                              disabled={!s.alive || !s.appeared}
                              onClick={() =>
                                safely(() =>
                                  setSession(
                                    setContentPersonStatus(
                                      session,
                                      c.id,
                                      s.recruited ? 'released' : 'recruited',
                                    ),
                                  ),
                                )
                              }
                            >
                              {s.recruited ? 'Liberar' : 'Reclutar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {session.events.length > 0 && (
                <p>
                  Llegadas pendientes:{' '}
                  {session.events
                    .map(
                      (e: any) =>
                        `${draft.characters.find((c: any) => c.id === draft.placements.find((p: any) => p.id === e.placement).character)?.name} (${clock(e.at)})`,
                    )
                    .join(', ')}
                </p>
              )}
            </>
          )}
          <h2>Prueba de tiro</h2>
          <p>
            Usa las reglas de combate del juego. Permite comprobar disparo y
            recarga. Los contratos, diálogos, equipo transferible y habilidades
            especiales se integrarán en las próximas etapas.
          </p>
          <label>
            Personaje
            <select
              value={selected || draft.characters[0]?.id || ''}
              onChange={(e) => setSelected(e.target.value)}
            >
              {draft.characters.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={!!errors.length || !draft.characters.length}
            onClick={() =>
              safely(() =>
                setBattle(
                  createContentTestRange(
                    draft,
                    selected || draft.characters[0].id,
                    seed,
                  ),
                ),
              )
            }
          >
            Iniciar prueba de tiro
          </button>
          {battle && (
            <div className="range">
              <h3>
                {player.name} · {weaponFor(player).name}
              </h3>
              <p>
                PA: {player.ap} · Carga: {player.loaded} · Reserva:{' '}
                {player.ammo} · Salud del oponente: {target.hp}
              </p>
              <p>
                {shot?.reason ??
                  `Probabilidad de impacto: ${Math.round(shot?.chance ?? 0)}% · Coste: ${shot?.pa ?? '—'} PA`}
              </p>
              <div className="toolbar">
                <button
                  disabled={target.hp <= 0 || battle.phase !== 'player'}
                  onClick={() =>
                    safely(() =>
                      setBattle(
                        actBattle(battle, {
                          type: 'fire',
                          unitId: player.id,
                          targetId: target.id,
                        }),
                      ),
                    )
                  }
                >
                  Disparar
                </button>
                <button
                  disabled={battle.phase !== 'player'}
                  onClick={() =>
                    safely(() =>
                      setBattle(
                        actBattle(battle, {
                          type: 'reload',
                          unitId: player.id,
                        }),
                      ),
                    )
                  }
                >
                  Recargar
                </button>
                <button
                  disabled={!player.jammed}
                  onClick={() =>
                    safely(() =>
                      setBattle(
                        actBattle(battle, {
                          type: 'reprime',
                          unitId: player.id,
                        }),
                      ),
                    )
                  }
                >
                  Cebar llave
                </button>
                <button
                  onClick={() => safely(() => setBattle(endTurn(battle)))}
                >
                  Pasar turno del oponente
                </button>
              </div>
              {battle.lastError && <p role="alert">{battle.lastError}</p>}
              <ol className="combat-log">
                {battle.log.slice(-6).map((text: string, i: number) => (
                  <li key={i}>{text}</li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}
      <footer>
        <strong>
          {errors.length
            ? `${errors.length} problemas por corregir`
            : 'Contenido válido'}
        </strong>
        <span>
          {ready
            ? 'Borrador local · exportá una copia para compartirlo'
            : 'Cargando borrador…'}
        </span>
        {errors.length > 0 && (
          <ul>
            {errors.slice(0, 15).map((e: string, i: number) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
      </footer>
    </main>
  );
}
