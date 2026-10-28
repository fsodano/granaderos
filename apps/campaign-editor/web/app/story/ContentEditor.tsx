'use client';
import { editorErrorMessage } from '../../../infrastructure/editor-error-message.ts';
import {
  formatAP,
  displayedAP,
  storedAP,
  isAPField,
} from '../../../../../packages/game/public/campaign-editor-api.js';

import { gamePath } from '../../lib/game-path.ts';
import { pagePath, sitePath } from '../../../../web/game-preview-assets.js';
import {
  editorCampaignBase,
  editorCampaignContent,
  editorCampaignURL,
  editorDraftKey,
} from '../../lib/editor-campaign.ts';
import { loadInstalledCampaign, type CampaignEntry } from '../../lib/campaign-library.ts';
import { contentIdentity } from '../../../../../packages/campaign-format/content-identity.js';
import { campaignLaunchSearch } from '../../../../../packages/game/public/campaign-editor-api.js';
import { campaignSectors } from '../../../../../packages/game/public/campaign-editor-api.js';
import { BuildIdentity } from '../../../../web/game-preview.ts';
import AlternativeLoads from './AlternativeLoads.tsx';
import { storyReferences } from '../../../../../packages/game/public/campaign-editor-api.js';
import DialogueEditor from './DialogueEditor.tsx';
import QuestEditor from './QuestEditor.tsx';
import ErrandEditor from './ErrandEditor.tsx';
import { errandContacts } from '../../../../../packages/game/public/campaign-editor-api.js';
import CampaignRules from './CampaignRules.tsx';
import ContractPricePreview from './ContractPricePreview.tsx';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  ATTRIBUTE_FIELDS,
  FIREARM_TEMPLATES,
  BLADE_TEMPLATES,
  CONTENT_LIMIT,
  defaultContentPackage,
  validateContentPackage,
  parseContentPackage,
  encodeContentPackage,
} from '../../../../../packages/game/public/campaign-editor-api.js';
import {
  createContentSession,
  advanceContentSession,
  setContentPersonStatus,
  encodeContentSession,
  decodeContentSession,
} from '../../../../../packages/game/public/campaign-editor-api.js';
import {
  createContentTestRange,
  contentShotPreview,
} from '../../../../../packages/game/public/campaign-editor-api.js';
import ArtilleryProfiles from './ArtilleryProfiles.tsx';
import {
  actBattle,
  endTurn,
  weaponFor,
} from '../../../../../packages/game/public/campaign-editor-api.js';
import { initialCampaign } from '../../../../../packages/game/public/campaign-editor-api.js';
import { encodeSave } from '../../../../../packages/game/public/campaign-editor-api.js';
import { campaignContentReport } from '../../../../../packages/game/public/campaign-editor-api.js';
import { CONTENT_LAUNCH_KEY } from '../../../../../packages/game/public/campaign-editor-api.js';
import './editor.css';
import '../editor-tools.css';
import {
  CHARACTER_ABILITIES,
  legacyCharacterAbilities,
} from '../../../../../packages/game/public/campaign-editor-api.js';
import {
  isContractCharacter,
  isHistoricalCharacter,
  isWorldCharacter,
  legacyOperativeId,
  hasGenericCharacterDefinitions,
} from '../../../../../packages/game/public/campaign-editor-api.js';
import {
  conductObserverDefinition,
  conductNoncombatantDefinition,
} from '../../../../../packages/game/public/campaign-editor-api.js';
import CharacterPresentation from './CharacterPresentation.tsx';
import CharacterSupplies from './CharacterSupplies.tsx';
import CharacterCondition from './CharacterCondition.tsx';
import postCampaign from '../../../../../content/campaigns/la-ruta-de-las-postas.json';
import { SPEECH_EVENTS } from '../../../../../packages/game/public/campaign-editor-api.js';
import { characterPresentationDefaults } from '../../../../../packages/game/public/campaign-editor-api.js';
import { CONTENT_TRAITS } from '../../../../../packages/game/public/campaign-editor-api.js';
import {
  FIREARM_PRICES,
  BLADE_PRICES,
  isBladeDefinition,
} from '../../../../../packages/game/public/campaign-editor-api.js';
import {
  AMMO_TYPES,
  ammunitionForWeapon,
} from '../../../../../packages/game/public/campaign-editor-api.js';
import { BUTTSTOCK } from '../../../../../packages/game/public/campaign-editor-api.js';
import { BASE_FIREARMS } from '../../../../../packages/game/public/campaign-editor-api.js';
import { BASE_ITEMS } from '../../../../../packages/game/public/campaign-editor-api.js';
import PlacementMap from './PlacementMap.tsx';
import ArrivalSites from './ArrivalSites.tsx';
import ForceEquipment from './ForceEquipment.tsx';
import AdvancedContent from './AdvancedContent.tsx';
import CharacterPreview from '../studio/CharacterPreview.tsx';
import QuestSandbox from '../studio/QuestSandbox.tsx';
import { DocumentDraftProvider, DocumentDraftStatus } from '../studio/DocumentDrafts.tsx';
import { forceWeaponUsers } from '../../../../../packages/game/public/campaign-editor-api.js';
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
  stockAP: 'PA del golpe con la culata',
  stockDamage: 'Daño de la culata',
  stockReach: 'Alcance de la culata',
  capacity: 'Capacidad de carga',
  weight: 'Peso (kg)',
  price: 'Precio (pesos)',
};
const clock = (minute: number) =>
  `Día ${Math.floor(minute / 1440) + 1} · ${String(Math.floor((minute % 1440) / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
function nextId(prefix: string, items: any[]) {
  let n = 1;
  while (
    items.some((i) => i.id === `${prefix}-${n}`) ||
    (prefix === 'person' && legacyOperativeId(`${prefix}-${n}`) !== undefined)
  )
    n++;
  return `${prefix}-${n}`;
}
export type ContentEditorProps = {
  content?: any;
  onContentChange?: (next: any) => void;
  embedded?: boolean;
  initialTab?: string;
  resolveAsset?: (reference: string) => string;
};
const editorSections = [
  {
    id: 'characters',
    name: 'Personajes',
    help: 'Editá las fichas, el equipo, la apariencia y las conversaciones.',
  },
  {
    id: 'weapons',
    name: 'Armas',
    help: 'Configurá armas portátiles y modelos de artillería. Los cambios se aplican a las fichas que los usan.',
  },
  {
    id: 'arrivals',
    name: 'Llegadas',
    help: 'Elegí destinos de contratación y puntos de recepción en el mundo de esta campaña.',
  },
  {
    id: 'rules',
    name: 'Reglas',
    help: 'Configurá el estado inicial, los capítulos y las reglas de campaña.',
  },
  {
    id: 'quests',
    name: 'Encargos',
    help: 'Definí objetivos, plazos y requisitos para las conversaciones.',
  },
  {
    id: 'errands',
    name: 'Encargos locales',
    help: 'Prepará entregas físicas, escoltas y recompensas con contactos del mapa.',
  },
  {
    id: 'advanced',
    name: 'Eventos y suministros',
    help: 'Programá eventos y configurá hallazgos, importaciones y suministros.',
  },
  {
    id: 'quests-test',
    name: 'Probar encargos',
    help: 'Probá conversaciones y objetivos con las acciones reales del juego en una sesión separada.',
  },
  {
    id: 'test',
    name: 'Pruebas',
    help: 'Comprobá apariciones y armas sin cambiar una partida guardada.',
  },
];
export default function ContentEditor({
  content,
  onContentChange,
  embedded = false,
  initialTab = 'characters',
  resolveAsset = sitePath,
}: ContentEditorProps = {}) {
  const editorId = `content-editor-${useId().replace(/:/g, '')}`;
  const EditorRoot = embedded ? 'section' : 'main';
  const [exportFile, setExportFile] = useState<{ text: string; name: string } | null>(null);
  const [exportStatus, setExportStatus] = useState('');
  const [exportUrl, setExportUrl] = useState<string>();
  useEffect(() => {
    if (!exportFile) {
      setExportUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(new Blob([exportFile.text], { type: 'application/json' }));
    setExportUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [exportFile]);
  function download(text: string, name: string) {
    setExportStatus('');
    setExportFile({ text, name });
  }
  const [localDraft, setDraft] = useState<any>(() => content ?? defaultContentPackage());
  const draft = embedded && content ? content : localDraft;
  const [baseContent, setBaseContent] = useState<any>(() => defaultContentPackage()),
    [campaigns, setCampaigns] = useState<CampaignEntry[]>([]),
    [campaignId, setCampaignId] = useState('granaderos'),
    [draftKey, setDraftKey] = useState(editorDraftKey('story', 'granaderos'));
  const [loadingCampaign, setLoadingCampaign] = useState(!embedded);
  const loadingSequence = useRef(0);
  const [past, setPast] = useState<any[]>([]);
  const [future, setFuture] = useState<any[]>([]);
  const [tab, setTab] = useState(
    editorSections.some((section) => section.id === initialTab) ? initialTab : 'characters',
  );
  const [weaponKind, setWeaponKind] = useState('handheld');
  const [selected, setSelected] = useState('person-0');
  const [searches, setSearches] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(embedded);
  const [session, setSession] = useState<any>(null);
  const [battle, setBattle] = useState<any>(null);
  const [seed, setSeed] = useState(18130203);
  const [loaded, setLoaded] = useState('');
  useEffect(() => {
    if (embedded) {
      setSession(null);
      setBattle(null);
    }
  }, [embedded, content]);
  const testImportRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const portraitRef = useRef<HTMLInputElement>(null);
  const weaponArtRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (embedded) return;
    let active = true;
    editorCampaignBase()
      .then(({ entries, loaded }) => {
        if (active) {
          setCampaigns(entries);
          openBase(loaded);
        }
      })
      .catch((error: any) => {
        if (active) setNotice(editorErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoadingCampaign(false);
      });
    return () => {
      active = false;
      loadingSequence.current++;
    };
  }, []);
  function openBase(loaded: any) {
    const base = editorCampaignContent(loaded.content),
      key = editorDraftKey('story', loaded.entry.id);
    setBaseContent(base);
    setDraft(base);
    setCampaignId(loaded.entry.id);
    setDraftKey(key);
    editorCampaignURL(loaded.entry);
    setPast([]);
    setFuture([]);
    setSession(null);
    setBattle(null);
    try {
      const saved =
          localStorage.getItem(key) ??
          (loaded.entry.id === 'granaderos'
            ? localStorage.getItem('granaderos.content-draft.v1')
            : null),
        value = saved ? editorCampaignContent(parseContentPackage(saved)) : base;
      setDraft(value);
      setSelected(value.characters[0]?.id ?? '');
      setReady(true);
    } catch {
      setNotice(
        'No se pudo recuperar el borrador. El archivo original se conserva hasta que hagas un cambio o importes una copia.',
      );
      setReady(false);
    }
  }
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
    } catch (error: any) {
      if (sequence === loadingSequence.current) setNotice(editorErrorMessage(error));
    } finally {
      if (sequence === loadingSequence.current) setLoadingCampaign(false);
    }
  }
  useEffect(() => {
    if (embedded || !ready) return;
    try {
      const text = JSON.stringify(draft);
      if (new TextEncoder().encode(text).length > CONTENT_LIMIT) throw Error();
      localStorage.setItem(draftKey, text);
    } catch {
      setNotice('No se pudo guardar el borrador. Exportá una copia antes de salir.');
    }
  }, [draft, ready, draftKey, embedded]);
  const CAMPAIGN_SECTORS = campaignSectors(draft),
    CONTENT_SECTORS = CAMPAIGN_SECTORS;
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
  const activeSection = editorSections.find((section) => section.id === tab)!;
  const selectionFiltered = Boolean(
    searchable && query && item && !visibleItems.some((entry: any) => entry.id === item.id),
  );
  const clearSearch = () => setSearches((current) => ({ ...current, [collection]: '' }));
  const contractDefaults =
    tab === 'characters'
      ? (embedded ? draft : baseContent).characters.find((c: any) => c.id === item?.id)
      : null;
  const characterTraits = item?.traits ?? contractDefaults?.traits ?? [];
  const ridingSkill = item?.ridingSkill ?? contractDefaults?.ridingSkill ?? 0;
  const placement = draft.placements.find((p: any) => p.character === item?.id);
  function omitOptionalFields(value: any): any {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(omitOptionalFields);
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, omitOptionalFields(entry)]),
    );
  }
  function change(next: any) {
    next = omitOptionalFields(next);
    if (next.campaignOrigin) next = editorCampaignContent(next);
    setReady(true);
    if (embedded) {
      onContentChange?.(next);
      setSession(null);
      setBattle(null);
      return;
    }
    setPast((p) => [...p.slice(-29), draft]);
    setFuture([]);
    setDraft(next);
    setSession(null);
    setBattle(null);
  }
  function update(patch: any) {
    change({
      ...draft,
      [collection]: items.map((i: any) => (i.id === item.id ? { ...i, ...patch } : i)),
    });
  }
  function updatePlacement(patch: any) {
    const next = { ...placement, ...patch };
    if (next.selection === 'alternate' && (next.mode !== 'daily' || next.sectors.length !== 2))
      patch = { ...patch, selection: 'random' };
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
          sectors: [draft.headquarters ?? CAMPAIGN_SECTORS[0]?.id],
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
      setNotice(editorErrorMessage(e));
    }
  }
  useEffect(() => {
    if (embedded) return;
    function onHistoryKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.defaultPrevented) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="dialog"]',
        )
      )
        return;
      const key = event.key.toLowerCase(),
        back = key === 'z' && !event.shiftKey,
        forward = key === 'y' || (key === 'z' && event.shiftKey);
      if (back && past.length) {
        event.preventDefault();
        undo();
      }
      if (forward && future.length) {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onHistoryKey);
    return () => window.removeEventListener('keydown', onHistoryKey);
  }, [embedded, draft, past, future]);
  function navigateSection(id: string) {
    setTab(id);
    setSelected('');
  }
  function onSectionKey(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    const offsets: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    let next = index;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = editorSections.length - 1;
    else if (event.key in offsets)
      next = (index + offsets[event.key] + editorSections.length) % editorSections.length;
    else return;
    event.preventDefault();
    navigateSection(editorSections[next].id);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  }
  function onEntityKey(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === 'ArrowDown') next = Math.min(index + 1, visibleItems.length - 1);
    else if (event.key === 'ArrowUp') next = Math.max(index - 1, 0);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = visibleItems.length - 1;
    else return;
    event.preventDefault();
    setSelected(visibleItems[next].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  }
  function add(kind = 'contract') {
    let added: any;
    if (collection === 'characters')
      added = {
        ...structuredClone(
          draft.characters.find(isContractCharacter) ??
            baseContent.characters.find(isContractCharacter) ??
            defaultContentPackage().characters.find(isContractCharacter)!,
        ),
        id: nextId('person', draft.characters),
        name: 'Nuevo personaje',
        nickname: 'Nuevo',
        role: '',
        biography: '',
        traits: [],
        ridingSkill: 0,
        abilities: [],
        personality: '',
        speech: Object.fromEntries(SPEECH_EVENTS.map((event) => [event, ''])),
        spriteAppearance: hasGenericCharacterDefinitions(draft) ? 'worker' : 'granadero',
        weapon: draft.weapons[0]?.id ?? null,
        blade: draft.weapons.find(isBladeDefinition)?.id,
      };
    else if (collection === 'weapons')
      added = {
        ...structuredClone(
          draft.weapons.find((w: any) => isBladeDefinition(w) === (kind === 'blade')) ??
            baseContent.weapons.find((w: any) => isBladeDefinition(w) === (kind === 'blade')) ??
            defaultContentPackage().weapons.find(
              (w) => isBladeDefinition(w) === (kind === 'blade'),
            )!,
        ),
        id: nextId(kind === 'blade' ? 'blade' : 'firearm', draft.weapons),
        name: 'Nueva arma',
      };
    if (collection === 'characters' && kind === 'encounter') {
      delete added.arrivalHours;
      Object.assign(added, {
        name: 'Nuevo habitante',
        nickname: 'Habitante',
        role: 'Habitante',
        recruitmentSource: 'encounter',
        service: 'permanent',
        monthlyPay: 0,
        serviceGuarantee: 0,
        weapon: null,
        spriteAppearance: 'worker',
        encounter: {
          recruitable: false,
          greeting: 'Buen día.',
          requiredLeadership: 0,
          requiredLiberated: 0,
          requiredSector: null,
        },
      });
    }
    change({ ...draft, [collection]: [...items, added] });
    setSelected(added.id);
    setSearches((current) => ({ ...current, [collection]: '' }));
  }
  function duplicateCharacter() {
    if (collection !== 'characters' || (isHistoricalCharacter(item, draft) && !draft.campaignStory))
      return;
    const added = {
      ...structuredClone(item),
      ...structuredClone(characterPresentationDefaults(item, draft)),
      abilities: [
        ...(item.abilities ??
          (hasGenericCharacterDefinitions(draft)
            ? []
            : legacyCharacterAbilities(legacyOperativeId(item.id)))),
      ],
      recruitmentSource: item.recruitmentSource ?? 'contract',
      service: item.service ?? 'contract',
      progression: item.progression ?? 'experience',
      traits: [...characterTraits],
      ridingSkill,
      id: nextId('person', draft.characters),
      name: `${item.name.slice(0, 92)} (copia)`,
    };
    if (isHistoricalCharacter(item, draft))
      Object.assign(added, {
        recruitmentSource: 'encounter',
        service: 'permanent',
        monthlyPay: 0,
        serviceGuarantee: 0,
        progression: 'experience',
        encounter: {
          recruitable: true,
          greeting: 'Buen día. Hablemos de la campaña.',
          requiredLeadership: 0,
          requiredLiberated: 0,
          requiredSector: null,
        },
      });
    change({
      ...draft,
      characters: [...draft.characters, added],
      placements: placement
        ? [
            ...draft.placements,
            {
              ...structuredClone(placement),
              id: nextId('placement', draft.placements),
              character: added.id,
            },
          ]
        : draft.placements,
    });
    setSelected(added.id);
    setSearches((current) => ({ ...current, characters: '' }));
  }
  function remove() {
    if (collection === 'characters' && isHistoricalCharacter(item, draft) && !draft.campaignStory) {
      setNotice(
        'El avance histórico necesita sus mandos. Elegí capítulos propios en Reglas para quitar este personaje.',
      );
      return;
    }
    if (collection === 'characters' && Object.values(draft.campaignRoles ?? {}).includes(item.id)) {
      setNotice(
        'Quitá o reasigná su función de campaña en Reglas antes de eliminar este personaje.',
      );
      return;
    }
    if (collection === 'weapons' && forceWeaponUsers(draft, item.id).length) {
      setNotice('Asigná otra arma a las tropas que la usan.');
      return;
    }
    if (collection === 'characters') {
      const owner = draft.characters.find(
        (c: any) =>
          c.id !== item.id &&
          ['serviceRefusals', 'preferredCompanions'].some(
            (field) =>
              Array.isArray(c[field]) &&
              c[field].some((relationship: any) => relationship.character === item.id),
          ),
      );
      if (owner) {
        setNotice(
          `Quitá o reasigná las relaciones de ${owner.name} antes de eliminar a ${item.name}.`,
        );
        return;
      }
    }

    if (
      collection === 'characters' &&
      ((draft.errands ?? []).some((q: any) =>
        [q.npcId, ...(q.beneficiaries ?? []).map((recipient: any) => recipient.npcId)].some(
          (id) => errandContacts(draft).find((c) => c.id === id)?.characterId === item.id,
        ),
      ) ||
        storyReferences(draft.campaignStory, 'character', item.id) ||
        (draft.campaignEvents ?? []).some((event: any) =>
          event.conditions.some(
            (condition: any) =>
              ['character', 'supply'].includes(condition.type) && condition.character === item.id,
          ),
        ) ||
        (draft.quests ?? []).some((q: any) => q.requiredAlive?.includes(item.id)) ||
        draft.placements.some((p: any) => p.afterDeath === item.id) ||
        draft.characters.some(
          (owner: any) =>
            owner.id !== item.id &&
            owner.encounter?.dialogue?.nodes.some((n: any) =>
              n.choices.some(
                (choice: any) =>
                  choice.conditions?.some(
                    (c: any) =>
                      ['character', 'meeting', 'supply'].includes(c.type) &&
                      c.character === item.id,
                  ) ||
                  choice.effects?.some(
                    (e: any) => e.type === 'movement' && e.character === item.id,
                  ),
              ),
            ),
        ))
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
      placements:
        collection === 'characters'
          ? draft.placements.filter((p: any) => p.character !== item.id)
          : draft.placements,
    });
    setSelected('');
    setSearches((current) => ({ ...current, [collection]: '' }));
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > CONTENT_LIMIT) throw Error('El archivo supera 2 MB.');
      const value = parseContentPackage(await file.text());
      change(value);
      setSelected(value.characters[0]?.id ?? '');
      setNotice('Contenido importado. Podés deshacer para volver al borrador anterior.');
    } catch (e: any) {
      setNotice(editorErrorMessage(e));
    }
  }
  async function uploadImage(
    file: File | undefined,
    collection: 'characters' | 'weapons',
    field: 'portrait' | 'art',
  ) {
    if (!file || !item) return;
    const target = item.id;
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 250000)
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
      setNotice(editorErrorMessage(e) || 'No se pudo leer la imagen.');
    }
  }
  function numeric(key: string, value: number, attributes = false) {
    const actionPoints = !attributes && isAPField(key);
    const display = (value: number) => (actionPoints ? displayedAP(value) : value);
    return (
      <label key={key}>
        {labels[key] ?? key}
        <input
          type="number"
          value={Number.isFinite(value) ? display(value) : ''}
          min={display(key === 'maxHp' ? 15 : key.startsWith('stock') ? 1 : 0)}
          max={display(
            key === 'stockReach'
              ? 1.5
              : key === 'reloadAP'
                ? 500
                : key === 'price'
                  ? 1000000
                  : key === 'weight'
                    ? 30
                    : key === 'capacity'
                      ? 8
                      : key === 'reach'
                        ? 4
                        : 100,
          )}
          step={
            actionPoints
              ? displayedAP(1)
              : ['weight', 'reach', 'stockReach'].includes(key)
                ? 0.1
                : 1
          }
          onChange={(e) =>
            update(
              attributes
                ? {
                    attributes: {
                      ...item.attributes,
                      [key]: e.target.valueAsNumber,
                    },
                  }
                : {
                    [key]: actionPoints ? storedAP(e.target.valueAsNumber) : e.target.valueAsNumber,
                  },
            )
          }
        />
      </label>
    );
  }
  const player = battle?.units.find((u: any) => u.side === 'player');
  const target = battle?.units.find((u: any) => u.side === 'enemy');
  const shot = player && target ? contentShotPreview(battle, player, target) : null;
  return (
    <DocumentDraftProvider scope={`story:${draft.id}`}>
      <EditorRoot
        aria-label="Editor de contenido"
        aria-busy={loadingCampaign}
        className={`content-editor${embedded ? ' content-editor-embedded' : ''}`}
      >
        <a className="content-skip" href={`#${editorId}-panel`}>
          Ir al contenido de la sección
        </a>
        {!embedded && (
          <>
            <header className="content-header">
              <div>
                <div className="content-breadcrumbs">
                  <a href={pagePath(`/?campaign=${encodeURIComponent(campaignId)}`)}>
                    Editor de campañas
                  </a>
                  <span aria-hidden="true">/</span>
                  <span>Contenido</span>
                </div>
                <p className="eyebrow">Herramientas de autor</p>
                <h1>Editor de contenido</h1>
                <p>Personajes, equipo y objetivos en un mismo borrador.</p>
                <details className="content-build">
                  <summary>Información de versión</summary>
                  <BuildIdentity />
                </details>
              </div>
              <div
                className="toolbar content-actions"
                role="toolbar"
                aria-label="Acciones del borrador"
              >
                <div className="content-history">
                  <button
                    disabled={!past.length}
                    onClick={undo}
                    title="Deshacer · Ctrl/Cmd+Z"
                    aria-keyshortcuts="Control+Z Meta+Z"
                  >
                    Deshacer
                  </button>
                  <button
                    disabled={!future.length}
                    onClick={redo}
                    title="Rehacer · Ctrl/Cmd+Mayús+Z"
                    aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
                  >
                    Rehacer
                  </button>
                </div>
                <button onClick={() => importRef.current?.click()}>Importar</button>
                <button
                  className="primary"
                  disabled={!!errors.length}
                  title={
                    errors.length
                      ? 'Corregí los problemas de validación para exportar.'
                      : 'Descargar o copiar el contenido del borrador'
                  }
                  onClick={() =>
                    safely(() => download(encodeContentPackage(draft), `${draft.id}.json`))
                  }
                >
                  Exportar contenido
                </button>
              </div>
            </header>
            <details className="content-example">
              <summary>Campaña de ejemplo: La ruta de las postas</summary>
              <p>
                Partí de Córdoba, reuní una custodia y recuperá las comunicaciones con Tucumán y
                Salta. Incluye personajes, contratos, encuentros y tres capítulos propios.
              </p>
              <button
                onClick={() =>
                  safely(() => {
                    const value = parseContentPackage(JSON.stringify(postCampaign));
                    change(value);
                    setTab('characters');
                    setSelected(value.characters[0].id);
                    setSeed(8);
                    setSearches((current) => ({ ...current, characters: '' }));
                    setNotice(
                      'La ruta de las postas está cargada. Podés editarla o deshacer para recuperar el borrador anterior.',
                    );
                  })
                }
              >
                Cargar La ruta de las postas
              </button>{' '}
              <a href={sitePath('/campaigns/la-ruta-de-las-postas.json')} download>
                Descargar campaña de ejemplo
              </a>
              <p>
                Cargarla reemplaza el borrador y permite deshacer. Las partidas iniciadas conservan
                su contenido.
              </p>
            </details>
          </>
        )}
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
              if (file.size > CONTENT_LIMIT) throw Error('El archivo supera 2 MB.');
              const restored = decodeContentSession(await file.text());
              change(restored.content);
              setSession(restored);
              setNotice('Prueba recuperada, con su contenido y sus decisiones.');
            } catch (e: any) {
              setNotice(editorErrorMessage(e));
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
        <input
          hidden
          ref={weaponArtRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Imagen del arma"
          onChange={(e) => {
            void uploadImage(e.target.files?.[0], 'weapons', 'art');
            e.target.value = '';
          }}
        />
        {notice && (
          <div role="status" className="notice">
            {notice}
            <button onClick={() => setNotice('')} aria-label="Cerrar aviso">
              ×
            </button>
          </div>
        )}
        {!embedded && (
          <>
            <div className="content-project-bar">
              <label>
                Campaña base
                <select
                  aria-label="Campaña base"
                  value={campaignId}
                  disabled={loadingCampaign}
                  onChange={(event) => {
                    const entry = campaigns.find((item) => item.id === event.target.value);
                    if (entry) void chooseBase(entry);
                  }}
                >
                  {campaigns.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="scope-note">
                Borrador local en este navegador. Exportá una copia para conservarlo o compartirlo.
                Las pruebas usan una sesión separada.
              </p>
              <div className="content-secondary-links">
                <a href={gamePath(`/?campaign=${encodeURIComponent(campaignId)}`)}>
                  Volver al juego
                </a>
                <a href={pagePath(`/?workspace=sector&campaign=${encodeURIComponent(campaignId)}`)}>
                  Editar sectores
                </a>
              </div>
            </div>
            <section className="campaign-launch" aria-label="Integración de campaña">
              <div className="content-launch-heading">
                <h2>Probar la campaña</h2>
                <small>
                  La partida conserva una copia de estas fichas y se guarda por separado.
                </small>
              </div>
              {integration &&
                (integration.blocked.length > 0 || integration.pending.length > 0) && (
                  <details open={integration.blocked.length > 0}>
                    <summary>
                      Revisar integración de campaña ·{' '}
                      {integration.blocked.length + integration.pending.length} avisos
                    </summary>
                    <ul>
                      {[...integration.blocked, ...integration.pending].map((message: string) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </details>
                )}
              <div className="toolbar">
                <button
                  disabled={!ready || !integration || integration.blocked.length > 0}
                  onClick={() =>
                    safely(() => {
                      const campaign = initialCampaign(seed, draft);
                      sessionStorage.setItem(CONTENT_LAUNCH_KEY, encodeSave(campaign));
                      window.location.assign(
                        gamePath(`/?${campaignLaunchSearch(campaign)}&launch=1`),
                      );
                    })
                  }
                >
                  Iniciar campaña con estas fichas
                </button>
                <a
                  href={gamePath(
                    `/?${campaignLaunchSearch({ contentCampaign: { identity: contentIdentity(draft) } })}`,
                  )}
                >
                  Continuar campaña del editor
                </a>
              </div>
            </section>
          </>
        )}
        <nav className="content-section-tabs" role="tablist" aria-label="Secciones del editor">
          {editorSections.map(({ id, name }, index) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${editorId}-tab-${id}`}
              aria-controls={`${editorId}-panel`}
              aria-selected={tab === id}
              tabIndex={tab === id ? 0 : -1}
              aria-current={tab === id ? 'page' : undefined}
              onKeyDown={(event) => onSectionKey(event, index)}
              onClick={() => navigateSection(id)}
            >
              {name}
            </button>
          ))}
        </nav>
        {!embedded && <DocumentDraftStatus onOpen={() => navigateSection('advanced')} />}
        <section
          id={`${editorId}-panel`}
          role="tabpanel"
          aria-labelledby={`${editorId}-tab-${tab}`}
          tabIndex={0}
          className="content-section-panel"
        >
          <div className="content-section-heading">
            <h2>{activeSection.name}</h2>
            <p>{activeSection.help}</p>
          </div>
          {tab === 'weapons' && (
            <nav aria-label="Tipos de armas">
              <button
                aria-pressed={weaponKind === 'handheld'}
                onClick={() => setWeaponKind('handheld')}
              >
                Armas portátiles
              </button>
              <button
                aria-pressed={weaponKind === 'artillery'}
                onClick={() => setWeaponKind('artillery')}
              >
                Artillería
              </button>
            </nav>
          )}
          {tab === 'advanced' ? (
            <AdvancedContent draft={draft} onChange={change} />
          ) : tab === 'quests-test' ? (
            <QuestSandbox content={draft} resolveAsset={resolveAsset} />
          ) : tab === 'weapons' && weaponKind === 'artillery' ? (
            <ArtilleryProfiles draft={draft} onChange={change} resolveAsset={resolveAsset} />
          ) : tab === 'rules' ? (
            <CampaignRules draft={draft} onChange={change} />
          ) : tab === 'errands' ? (
            <ErrandEditor draft={draft} onChange={change} />
          ) : tab === 'quests' ? (
            <QuestEditor draft={draft} onChange={change} />
          ) : tab === 'arrivals' ? (
            <ArrivalSites draft={draft} onChange={change} />
          ) : tab !== 'test' ? (
            <div className="editor-columns">
              <aside
                className="content-entity-sidebar"
                aria-label={tab === 'characters' ? 'Catálogo de personajes' : 'Catálogo de armas'}
              >
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
                <div className="content-create-actions">
                  <button className="primary" onClick={() => add()}>
                    + Crear{' '}
                    {tab === 'characters' ? 'personaje' : tab === 'weapons' ? 'arma' : 'aparición'}
                  </button>
                  {tab === 'characters' && (
                    <button onClick={() => add('encounter')}>Crear habitante</button>
                  )}
                  {tab === 'weapons' && (
                    <button onClick={() => add('blade')}>Crear arma blanca</button>
                  )}
                </div>
                {searchable && (
                  <label className="list-search">
                    {tab === 'characters' ? 'Buscar personajes' : 'Buscar armas'}
                    <input
                      type="search"
                      value={search}
                      aria-describedby={`${editorId}-search-help`}
                      placeholder={tab === 'characters' ? 'Nombre, apodo o ID' : 'Nombre o ID'}
                      onChange={(e) =>
                        setSearches((current) => ({
                          ...current,
                          [collection]: e.target.value,
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Escape' && search) {
                          event.preventDefault();
                          clearSearch();
                        }
                      }}
                    />
                    <small id={`${editorId}-search-help`}>
                      Escape limpia el filtro. En la lista, las flechas arriba y abajo cambian de
                      ficha.
                    </small>
                  </label>
                )}
                <div className="content-list-feedback">
                  <span role="status" aria-live="polite">
                    {visibleItems.length} de {items.length}{' '}
                    {tab === 'characters' ? 'personajes' : 'armas'}
                  </span>
                  {search && (
                    <button type="button" onClick={clearSearch}>
                      Limpiar búsqueda
                    </button>
                  )}
                </div>
                <div
                  className="entry-list"
                  aria-label={tab === 'characters' ? 'Personajes disponibles' : 'Armas disponibles'}
                >
                  {visibleItems.length === 0 && (
                    <p className="content-empty" role="status">
                      {query
                        ? 'No hay resultados para esta búsqueda.'
                        : 'El catálogo está vacío. Creá una ficha para comenzar.'}
                    </p>
                  )}
                  {visibleItems.map((i: any, index: number) => (
                    <button
                      key={i.id}
                      aria-pressed={i.id === item?.id}
                      tabIndex={i.id === item?.id || (selectionFiltered && index === 0) ? 0 : -1}
                      onKeyDown={(event) => onEntityKey(event, index)}
                      onClick={() => {
                        setSelected(i.id);
                      }}
                    >
                      {tab === 'weapons' && (
                        <img
                          className="weapon-thumbnail"
                          src={resolveAsset(i.art ?? `/art/weapon-${i.template}.png`)}
                          alt=""
                        />
                      )}
                      {i.name ??
                        draft.characters.find((c: any) => c.id === i.character)?.name ??
                        i.id}
                      <small>{i.id}</small>
                    </button>
                  ))}
                </div>
              </aside>
              <section className="form-panel" aria-label="Ficha seleccionada">
                {selectionFiltered && (
                  <p className="content-selection-note" role="status">
                    La ficha seleccionada no aparece en los resultados. El filtro conserva la ficha
                    que estás editando.
                  </p>
                )}
                {item ? (
                  <>
                    <div className="panel-heading">
                      <div>
                        <h2>{item.name ?? 'Regla de aparición'}</h2>
                        <code>{item.id}</code>
                      </div>
                      <div className="toolbar content-record-actions">
                        {tab === 'characters' &&
                          (!isHistoricalCharacter(item, draft) || draft.campaignStory) && (
                            <button onClick={duplicateCharacter}>
                              {isHistoricalCharacter(item, draft)
                                ? 'Copiar como habitante independiente'
                                : 'Duplicar personaje'}
                            </button>
                          )}
                        <button className="content-danger" onClick={remove}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                    {tab === 'characters' && (
                      <>
                        <div className="identity">
                          <img src={resolveAsset(item.portrait)} alt={`Retrato de ${item.name}`} />
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
                                onChange={(e) => update({ nickname: e.target.value })}
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
                              disabled={
                                !isContractCharacter(item) &&
                                !(isWorldCharacter(item) && item.service === 'contract')
                              }
                              title={
                                !isContractCharacter(item) && item.service !== 'contract'
                                  ? 'Servicio permanente'
                                  : undefined
                              }
                              onChange={(e) => update({ monthlyPay: e.target.valueAsNumber })}
                            />
                          </label>
                          <label>
                            Garantía de servicio (pesos)
                            <input
                              type="number"
                              min={0}
                              max={1000000}
                              value={item.serviceGuarantee ?? 0}
                              disabled={
                                isHistoricalCharacter(item, draft) || item.service !== 'contract'
                              }
                              onChange={(e) => update({ serviceGuarantee: e.target.valueAsNumber })}
                            />
                            <small>
                              Opcional; 0 conserva el costo original. Se paga aparte de la paga y se
                              devuelve según la salud al finalizar el servicio. No se devuelve al
                              capturar ni al fallecer.
                            </small>
                          </label>
                          <label>
                            Arma principal
                            <select
                              value={item.weapon ?? ''}
                              onChange={(e) => update({ weapon: e.target.value || null })}
                            >
                              <option value="">Sin arma principal</option>
                              {draft.weapons.map((w: any) => (
                                <option key={w.id} value={w.id}>
                                  {w.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Arma blanca
                            <select
                              value={item.blade ?? ''}
                              onChange={(e) => update({ blade: e.target.value || undefined })}
                            >
                              <option value="">Equipo original del personaje</option>
                              {draft.weapons.filter(isBladeDefinition).map((w: any) => (
                                <option key={w.id} value={w.id}>
                                  {w.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        {isContractCharacter(item) && (
                          <ContractPricePreview
                            draft={draft}
                            monthlyPay={item.monthlyPay}
                            serviceGuarantee={item.serviceGuarantee ?? 0}
                          />
                        )}
                        {isContractCharacter(item) && (
                          <label>
                            Tiempo de viaje (horas)
                            <input
                              type="number"
                              min={0}
                              max={168}
                              value={item.arrivalHours ?? 0}
                              onChange={(e) => update({ arrivalHours: e.target.valueAsNumber })}
                            />
                            <small>
                              El contrato comienza al llegar. Con 0, la llegada es inmediata si el
                              destino es seguro.
                            </small>
                          </label>
                        )}
                        {!isHistoricalCharacter(item, draft) && (
                          <fieldset>
                            <legend>Formación y progreso</legend>
                            <label>
                              Progreso por combate
                              <select
                                value={item.progression ?? 'experience'}
                                onChange={(e) => update({ progression: e.target.value })}
                              >
                                <option value="experience">Gana experiencia y niveles</option>
                                <option value="fixed">Conserva el nivel inicial</option>
                              </select>
                            </label>
                            <small>
                              La instrucción de atributos sigue disponible con ambas opciones.
                            </small>
                            <label>
                              Equitación
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={ridingSkill}
                                onChange={(e) => update({ ridingSkill: e.target.valueAsNumber })}
                              />
                              <small>
                                Reduce el esfuerzo y el coste de moverse a caballo. Equitación
                                experta asegura un mínimo de 80.
                              </small>
                            </label>
                            <div className="fields">
                              {CONTENT_TRAITS.map((trait) => (
                                <label key={trait.id}>
                                  <input
                                    type="checkbox"
                                    checked={characterTraits.includes(trait.id)}
                                    onChange={(e) =>
                                      update({
                                        traits: e.target.checked
                                          ? [...characterTraits, trait.id]
                                          : characterTraits.filter((id: string) => id !== trait.id),
                                      })
                                    }
                                  />
                                  {trait.name}
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        )}
                        {isWorldCharacter(item) && (
                          <fieldset aria-label="Encuentro del habitante">
                            <legend>Encuentro</legend>
                            <label>
                              Saludo al conversar
                              <textarea
                                rows={3}
                                maxLength={1000}
                                value={item.encounter.greeting}
                                onChange={(e) =>
                                  update({
                                    encounter: { ...item.encounter, greeting: e.target.value },
                                  })
                                }
                              />
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={item.encounter.recruitable}
                                onChange={(e) =>
                                  update({
                                    encounter: { ...item.encounter, recruitable: e.target.checked },
                                  })
                                }
                              />
                              Puede incorporarse a la escuadra
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={item.encounter.noncombatant === true}
                                disabled={
                                  !conductNoncombatantDefinition(item, placement) &&
                                  item.encounter.noncombatant !== true
                                }
                                onChange={(e) => {
                                  const encounter = { ...item.encounter };
                                  if (e.target.checked) encounter.noncombatant = true;
                                  else delete encounter.noncombatant;
                                  update({ encounter });
                                }}
                              />
                              Civil no combatiente
                              <small>
                                Solo para un habitante fijo, sin armas y que no puede incorporarse.
                                Esta condición no impide que reciba daño.
                              </small>
                            </label>
                            {item.encounter.recruitable && (
                              <>
                                <label>
                                  Tipo de servicio
                                  <select
                                    value={item.service}
                                    onChange={(e) =>
                                      update({
                                        service: e.target.value,
                                        ...(e.target.value === 'permanent'
                                          ? { monthlyPay: 0, serviceGuarantee: 0 }
                                          : {}),
                                      })
                                    }
                                  >
                                    <option value="permanent">Permanente, sin paga</option>
                                    <option value="contract">
                                      Contrato por los plazos de la campaña
                                    </option>
                                  </select>
                                </label>
                                <p>
                                  Se incorpora donde lo encontrás y conserva sus heridas.{' '}
                                  {item.service === 'contract'
                                    ? 'La paga mensual define el precio de cada plazo. El jugador elige y paga antes de incorporarlo.'
                                    : 'Sirve sin paga y sin fecha de vencimiento.'}
                                </p>
                                {item.service === 'contract' && (
                                  <ContractPricePreview
                                    draft={draft}
                                    monthlyPay={item.monthlyPay}
                                    serviceGuarantee={item.serviceGuarantee ?? 0}
                                  />
                                )}
                                <label>
                                  Liderazgo mínimo del interlocutor
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={item.encounter.requiredLeadership}
                                    onChange={(e) =>
                                      update({
                                        encounter: {
                                          ...item.encounter,
                                          requiredLeadership: e.target.valueAsNumber,
                                        },
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  Localidades seguras necesarias
                                  <input
                                    type="number"
                                    min={0}
                                    max={12}
                                    value={item.encounter.requiredLiberated}
                                    onChange={(e) =>
                                      update({
                                        encounter: {
                                          ...item.encounter,
                                          requiredLiberated: e.target.valueAsNumber,
                                        },
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  Localidad que debe estar liberada
                                  <select
                                    value={item.encounter.requiredSector ?? ''}
                                    onChange={(e) =>
                                      update({
                                        encounter: {
                                          ...item.encounter,
                                          requiredSector: e.target.value || null,
                                        },
                                      })
                                    }
                                  >
                                    <option value="">Ninguna</option>
                                    {CAMPAIGN_SECTORS.map((s: any) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </>
                            )}
                          </fieldset>
                        )}
                        {isWorldCharacter(item) && (
                          <DialogueEditor
                            content={draft}
                            key={item.id}
                            ownerId={item.id}
                            characters={draft.characters}
                            quests={draft.quests ?? []}
                            value={item.encounter.dialogue}
                            greeting={item.encounter.greeting}
                            onChange={(dialogue) =>
                              update({ encounter: { ...item.encounter, dialogue } })
                            }
                          />
                        )}
                        <fieldset aria-label="Habilidades de combate">
                          <legend>Habilidades de combate</legend>
                          <p>
                            Elegí las capacidades y condiciones de servicio de este personaje. Sin
                            casillas marcadas, no tendrá ninguna de estas capacidades o condiciones.
                            Las funciones de historia se conservan por ahora.
                          </p>
                          <div className="fields">
                            {CHARACTER_ABILITIES.map((ability) => {
                              const abilities =
                                item.abilities ??
                                (hasGenericCharacterDefinitions(draft)
                                  ? []
                                  : legacyCharacterAbilities(legacyOperativeId(item.id)));
                              const incompatible =
                                ability.contractOnly && !conductObserverDefinition(item);
                              return (
                                <label key={ability.id}>
                                  <input
                                    type="checkbox"
                                    checked={abilities.includes(ability.id)}
                                    disabled={incompatible && !abilities.includes(ability.id)}
                                    title={
                                      incompatible
                                        ? 'Solo para candidatos por contrato con servicio pagado explícito.'
                                        : undefined
                                    }
                                    onChange={(e) =>
                                      update({
                                        abilities: e.target.checked
                                          ? [...abilities, ability.id]
                                          : abilities.filter((id: string) => id !== ability.id),
                                      })
                                    }
                                  />
                                  {ability.name}
                                  <small>{ability.description}</small>
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>
                        <CharacterSupplies character={item} onChange={update} />
                        <CharacterCondition character={item} onChange={update} />
                        {embedded && (
                          <CharacterPreview
                            content={draft}
                            character={item}
                            resolveAsset={resolveAsset}
                          />
                        )}
                        <CharacterPresentation
                          content={draft}
                          character={item}
                          portraits={(embedded ? draft : baseContent).characters}
                          characters={draft.characters}
                          weapon={
                            draft.weapons.find((w: any) => w.id === item.weapon)?.template ?? 0
                          }
                          resolveAsset={resolveAsset}
                          onChange={update}
                        />
                        <h3>Atributos</h3>
                        <div className="fields">
                          {ATTRIBUTE_FIELDS.map((k) => numeric(k, item.attributes[k], true))}
                        </div>
                      </>
                    )}
                    {tab === 'weapons' && (
                      <>
                        <img
                          className="weapon-preview"
                          src={resolveAsset(item.art ?? `/art/weapon-${item.template}.png`)}
                          alt={item.name}
                        />
                        <button onClick={() => weaponArtRef.current?.click()}>
                          Cambiar imagen del arma
                        </button>
                        <button disabled={!item.art} onClick={() => update({ art: undefined })}>
                          Usar imagen de la familia
                        </button>
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
                            onChange={(e) => update({ template: Number(e.target.value) })}
                          >
                            {(isBladeDefinition(item) ? BLADE_TEMPLATES : FIREARM_TEMPLATES).map(
                              (t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        {!isBladeDefinition(item) && (
                          <fieldset>
                            <legend>Munición compatible</legend>
                            <label>
                              Familia de munición
                              <select
                                value={item.ammunitionFamily ?? ''}
                                onChange={(e) =>
                                  update({
                                    ammunitionFamily: e.target.value || undefined,
                                    alternativeLoads: undefined,
                                  })
                                }
                              >
                                <option value="">
                                  Original · {ammunitionForWeapon(item.template)?.name}
                                </option>
                                {Object.entries(AMMO_TYPES).map(([id, ammo]) => (
                                  <option key={id} value={id}>
                                    {ammo.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <p>
                              Esta es la familia principal del arma. Cambiar de arma no convierte
                              los cartuchos que ya lleva el soldado. La elección se conserva en la
                              campaña guardada.
                            </p>
                          </fieldset>
                        )}
                        {!isBladeDefinition(item) && (
                          <AlternativeLoads weapon={item} onChange={update} />
                        )}
                        {!isBladeDefinition(item) && (
                          <fieldset>
                            <legend>Penetración de la carga principal</legend>
                            <label>
                              Pérdida de penetración por distancia
                              <input
                                type="number"
                                min={0}
                                max={1}
                                step={0.05}
                                value={item.materialRangeSlope ?? ''}
                                onChange={(e) =>
                                  update({
                                    materialRangeSlope:
                                      e.target.value === '' ? undefined : e.target.valueAsNumber,
                                  })
                                }
                              />
                            </label>
                            <p>
                              Más allá del alcance de esta carga, aumenta la resistencia de la
                              cobertura. El valor 0,25 añade un 25 % de resistencia al entrar en
                              material al doble del alcance. Vacío o cero conserva la resistencia
                              original. Cada alternativa tiene su propio valor. Es una regla de
                              juego, no una velocidad medida.
                            </p>
                          </fieldset>
                        )}
                        {!isBladeDefinition(item) && (
                          <fieldset>
                            <legend>Energía de la carga principal</legend>
                            <label>
                              <input
                                type="checkbox"
                                checked={item.projectileEnergy !== undefined}
                                onChange={(e) =>
                                  update(
                                    e.target.checked
                                      ? {
                                          projectileEnergy: {
                                            model: 'kinetic-energy-v1',
                                            massGrams: 32,
                                            muzzleVelocityMps: 265,
                                          },
                                        }
                                      : {
                                          projectileEnergy: undefined,
                                          projectileAirDrag: undefined,
                                        },
                                  )
                                }
                              />
                              Usar masa y velocidad para el impacto
                            </label>
                            {item.projectileEnergy && (
                              <>
                                <label>
                                  Masa total de la carga principal (g)
                                  <input
                                    type="number"
                                    min={0.1}
                                    max={40}
                                    step={0.1}
                                    value={item.projectileEnergy.massGrams}
                                    onChange={(e) =>
                                      update({
                                        projectileEnergy: {
                                          ...item.projectileEnergy,
                                          massGrams: e.target.valueAsNumber,
                                        },
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  Velocidad inicial de la carga principal (m/s)
                                  <input
                                    type="number"
                                    min={25}
                                    max={600}
                                    step={1}
                                    value={item.projectileEnergy.muzzleVelocityMps}
                                    onChange={(e) =>
                                      update({
                                        projectileEnergy: {
                                          ...item.projectileEnergy,
                                          muzzleVelocityMps: e.target.valueAsNumber,
                                        },
                                      })
                                    }
                                  />
                                </label>
                              </>
                            )}
                            <p>
                              La energía inicial depende de la masa total y del cuadrado de la
                              velocidad. La cobertura, los cuerpos y los rebotes gastan esa energía.
                              El daño conserva su límite; un impacto débil puede no herir. La
                              conversión de 20 J por punto es ajuste de Granaderos, sin escala
                              física para la trayectoria. Cada cartucho completo pesa 40 g; la masa
                              del proyectil no puede superarlo. Cada alternativa usa su propio
                              modelo.
                            </p>
                            <label>
                              <input
                                type="checkbox"
                                checked={item.projectileAirDrag !== undefined}
                                disabled={!item.projectileEnergy}
                                onChange={(e) =>
                                  update({
                                    projectileAirDrag: e.target.checked
                                      ? {
                                          model: 'range-energy-retention-v1',
                                          retentionAtRange: 0.8,
                                        }
                                      : undefined,
                                  })
                                }
                              />
                              Pérdida de energía en el aire de la carga principal
                            </label>
                            {item.projectileAirDrag && (
                              <label>
                                Energía restante al alcance principal (%)
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={Number(
                                    (item.projectileAirDrag.retentionAtRange * 100).toPrecision(15),
                                  )}
                                  onChange={(e) =>
                                    update({
                                      projectileAirDrag: {
                                        ...item.projectileAirDrag,
                                        retentionAtRange: e.target.valueAsNumber / 100,
                                      },
                                    })
                                  }
                                />
                              </label>
                            )}
                            <p>
                              Requiere masa y velocidad en esta carga. El porcentaje indica la
                              energía que conserva tras una distancia de vuelo libre igual a su
                              alcance, antes de otras pérdidas. Debe ser mayor que cero y no superar
                              100; 100 no pierde energía en el aire. Un valor menor puede reducir el
                              daño y la penetración. Desactivado conserva la energía original. Cada
                              alternativa se configura por separado. Es ajuste de juego; no cambia
                              el tiempo de vuelo ni la trayectoria.
                            </p>
                          </fieldset>
                        )}
                        <p>
                          La familia conserva sus técnicas de combate. El nombre, la imagen y estos
                          valores se usan en la campaña, la armería y el equipo recuperado. La
                          prueba de tiro admite armas de fuego.
                        </p>
                        {!isBladeDefinition(item) && (
                          <p>
                            Los PA para levantar el arma están incluidos en el primer disparo.
                            Mientras el soldado conserve la posición de tiro, los siguientes
                            disparos descuentan ese costo. Moverse, recargar o cambiar de postura
                            vuelve a bajar el arma. Cero conserva el costo completo en cada disparo.
                          </p>
                        )}
                        <div className="fields">
                          {(isBladeDefinition(item)
                            ? ['damage', 'ap', 'reach']
                            : ['damage', 'fireAP', 'readyAP', 'aimAP', 'reloadAP', 'range']
                          ).map((k) => numeric(k, item[k]))}
                          {!isBladeDefinition(item) && (
                            <fieldset>
                              <legend>Golpe con la culata</legend>
                              <p>
                                Se usa al atacar cuerpo a cuerpo con esta arma de fuego. No consume
                                cartuchos. Su alcance máximo es una casilla contigua, incluidas las
                                diagonales. Para cargar, seleccioná un arma blanca.
                              </p>
                              {numeric('stockAP', item.stockAP ?? BUTTSTOCK.ap)}
                              {numeric('stockDamage', item.stockDamage ?? BUTTSTOCK.damage)}
                              {numeric('stockReach', item.stockReach ?? BUTTSTOCK.reach)}
                            </fieldset>
                          )}
                          {!isBladeDefinition(item) &&
                            numeric(
                              'capacity',
                              item.capacity ??
                                BASE_FIREARMS[item.template as keyof typeof BASE_FIREARMS]
                                  ?.capacity,
                            )}
                          {numeric(
                            'weight',
                            item.weight ?? (BASE_ITEMS as any)[item.template]?.weight,
                          )}
                          {numeric(
                            'price',
                            item.price ??
                              ({ ...FIREARM_PRICES, ...BLADE_PRICES } as any)[item.template],
                          )}
                        </div>
                      </>
                    )}
                    {tab === 'characters' && isContractCharacter(item) && (
                      <p>
                        Se contrata desde el boletín. No aparece en el mapa antes de contratarlo.
                      </p>
                    )}
                    {tab === 'characters' && !isContractCharacter(item) && (
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
                                <option value="once">Sorteo al inicio; ubicación definitiva</option>
                                <option value="daily">Puede cambiar cada día a las 04:00</option>
                              </select>
                            </label>
                            <PlacementMap
                              content={draft}
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
                                Ver todos los sectores seleccionados ({placement.sectors.length})
                              </summary>
                              <ul>
                                {placement.sectors.map((id: string) => (
                                  <li key={id}>
                                    {CONTENT_SECTORS.find((s: any) => s.id === id)?.name ?? id}{' '}
                                    <button
                                      aria-label={`Quitar ${CONTENT_SECTORS.find((s: any) => s.id === id)?.name ?? id}`}
                                      onClick={() =>
                                        updatePlacement({
                                          sectors: placement.sectors.filter(
                                            (selectedId: string) => selectedId !== id,
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
                            {placement.mode === 'daily' && (
                              <>
                                <label>
                                  Probabilidad diaria de elegir ubicación (%)
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={placement.moveChance}
                                    onChange={(e) =>
                                      updatePlacement({ moveChance: e.target.valueAsNumber })
                                    }
                                  />
                                </label>
                                <label>
                                  Elección diaria
                                  <select
                                    value={placement.selection ?? 'random'}
                                    onChange={(e) => updatePlacement({ selection: e.target.value })}
                                  >
                                    <option value="random">
                                      Sortear entre las celdas marcadas
                                    </option>
                                    <option
                                      value="alternate"
                                      disabled={placement.sectors.length !== 2}
                                    >
                                      Alternar entre dos celdas
                                    </option>
                                  </select>
                                </label>
                                <label>
                                  Protección mientras hay una escena abierta
                                  <select
                                    value={placement.loadedGuard ?? 'current'}
                                    onChange={(e) =>
                                      updatePlacement({ loadedGuard: e.target.value })
                                    }
                                  >
                                    <option value="current">
                                      No salir de la celda abierta ni entrar en ella
                                    </option>
                                    <option value="range">
                                      No trasladarse si alguna celda del rango está abierta
                                    </option>
                                  </select>
                                </label>
                              </>
                            )}
                            <p>
                              Un sorteo puede conservar el sector actual. Los muertos y reclutados
                              no se trasladan. El sector abierto queda protegido.
                            </p>
                            <label>
                              Aparece después de la muerte de
                              {!isWorldCharacter(item) && ' (solo simulación)'}
                              <select
                                value={placement.afterDeath ?? ''}
                                onChange={(e) =>
                                  updatePlacement({
                                    afterDeath: e.target.value || null,
                                  })
                                }
                              >
                                <option value="">Nadie: disponible desde el inicio</option>
                                {draft.characters
                                  .filter((c: any) => c.id !== placement.character)
                                  .map((c: any) => (
                                    <option value={c.id} key={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            {placement.afterDeath && (
                              <p>
                                La muerte confirmada activa a este personaje una sola vez. Llega con
                                su propia salud. Esta regla solo activa su aparición. Si la celda de
                                llegada está abierta, espera hasta que salgas.
                              </p>
                            )}
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
                            <button onClick={addPlacement}>Configurar aparición</button>
                          </>
                        )}
                      </section>
                    )}
                  </>
                ) : (
                  <div className="content-empty">
                    <h2>No hay una ficha seleccionada</h2>
                    <p>Creá una ficha desde el catálogo para comenzar.</p>
                  </div>
                )}
                {tab === 'weapons' && <ForceEquipment draft={draft} onChange={change} />}
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
                  <select value={loaded} onChange={(e) => setLoaded(e.target.value)}>
                    <option value="">Ninguno</option>
                    {CONTENT_SECTORS.map((s: any) => (
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
              <button onClick={() => testImportRef.current?.click()}>Cargar prueba</button>{' '}
              {session && (
                <button
                  onClick={() =>
                    safely(() => download(encodeContentSession(session), 'prueba-apariciones.json'))
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
                              advanceContentSession(session, session.minute + 60, loaded || null),
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
                              advanceContentSession(session, session.nextDaily, loaded || null),
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
                                {CONTENT_SECTORS.find((d: any) => d.id === s.sector)?.name ?? '—'}
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
                                      setSession(setContentPersonStatus(session, c.id, 'dead')),
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
                Usa las reglas de combate del juego. Permite comprobar disparo y recarga. Los
                contratos, diálogos, equipo transferible y habilidades especiales se integrarán en
                las próximas etapas.
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
                      createContentTestRange(draft, selected || draft.characters[0].id, seed),
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
                    PA: {formatAP(player.ap)} · Carga: {player.loaded} · Reserva: {player.ammo} ·
                    Salud del oponente: {target.hp}
                  </p>
                  <p>
                    {shot?.reason ??
                      `Probabilidad de impacto: ${Math.round(shot?.chance ?? 0)}% · Coste: ${formatAP(shot?.pa ?? '—')} PA`}
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
                      Resolver fallo
                    </button>
                    <button onClick={() => safely(() => setBattle(endTurn(battle)))}>
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
        </section>
        <footer className="content-validation">
          <strong className="editor-status" data-state={errors.length ? 'error' : 'valid'}>
            {errors.length ? `${errors.length} problemas por corregir` : 'Contenido válido'}
          </strong>
          <span>
            {ready
              ? embedded
                ? 'Cambios incluidos en el proyecto del taller'
                : 'Borrador local · exportá una copia para compartirlo'
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
        <Dialog
          open={Boolean(exportFile)}
          onOpenChange={(open) => {
            if (!open) setExportFile(null);
          }}
        >
          <DialogContent className="content-export-dialog">
            <DialogTitle>Exportar {exportFile?.name}</DialogTitle>
            <DialogDescription>
              Guardá el archivo o copiá el JSON para conservar una copia de tu contenido.
            </DialogDescription>
            <div role="status" aria-live="polite">
              {exportStatus}
            </div>
            <textarea aria-label="JSON del contenido" readOnly value={exportFile?.text ?? ''} />
            <div className="content-export-actions">
              <a href={exportUrl} download={exportFile?.name}>
                Descargar JSON
              </a>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(exportFile?.text ?? '');
                    setExportStatus('JSON copiado.');
                  } catch {
                    setExportStatus('Seleccioná el texto y copialo con el teclado.');
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
    </DocumentDraftProvider>
  );
}
