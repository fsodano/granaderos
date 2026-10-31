'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { BookOpen, Download, Menu, Volume2, VolumeX } from 'lucide-react';
import type { ChangeEvent } from 'react';
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { CampaignPresentation } from '../../../packages/campaign-format/types.ts';
import type { SaveStatus } from '../../../packages/game/application/get-save-status/get-save-status.repository.ts';
import { TalkToCharacterUseCase } from '../../../packages/game/application/talk-to-character/talk-to-character.use-case.ts';
import { battleFromRequest, prepareCampaignBattle } from '../../../packages/game/battle-handoff.js';
import { runBattleJob } from '../../../packages/game/battle-job.js';
import { dispatchCampaign, questForNPC, rosterFor } from '../../../packages/game/campaign.js';
import { withCharacterSpeech } from '../../../packages/game/character-events.js';
import { dialogueForNPC } from '../../../packages/game/content-dialogue.js';
import {
  campaignLaunchSearch,
  campaignStorageCandidates,
  campaignStorageKey,
  CONTENT_LAUNCH_KEY,
} from '../../../packages/game/content-launch.ts';
import { encounterHireTerms } from '../../../packages/game/encounters.js';
import { CampaignTalkToCharacterRepository } from '../../../packages/game/infrastructure/session/talk-to-character-repository.ts';
import { domainRefusalMessage } from '../../../packages/game/infrastructure/shared/domain-refusal-message.js';
import { removedSectorCharacters } from '../../../packages/game/military-remains.js';
import { missionStatus } from '../../../packages/game/missions.js';
import {
  playerKnownBattle,
  playerKnownError,
  playerKnownState,
} from '../../../packages/game/player-known-state.ts';
import type {
  CampaignAction,
  CampaignSnapshot,
} from '../../../packages/game/public/campaign-types.ts';
import type { BattleSnapshot } from '../../../packages/game/public/compatibility-types.ts';
import {
  createNewGameSession,
  restoreGameSnapshot,
} from '../../../packages/game/public/game-persistence-api.ts';
import { MAX_SAVE_BYTES } from '../../../packages/game/save-limits.js';
import { encodeSave } from '../../../packages/game/save.ts';
import { pendingArrivalDecisions } from '../../../packages/game/squad-travel.js';
import { actBattle, endTurn } from '../../../packages/game/tactical.js';
import { syncBattleTime, withCampaignTimeBoundary } from '../../../packages/game/time.js';
import { BattleAudio } from '../lib/battle-audio';
import { readBattleWorkerAction } from '../lib/battle-worker-values';
import {
  loadCampaignRegistry,
  loadInstalledCampaign,
  verifyCampaignResources,
  type CampaignEntry,
  type LoadedCampaign,
} from '../lib/campaign-library';
import { pagePath, sitePath } from '../lib/site-path.js';
import { useCampaignAutosave } from '../lib/useCampaignAutosave';
import Battlefield from './Battlefield';
import type { BrowserTool } from './browser-tools';
import BuildIdentity from './BuildIdentity';
import Campaign from './Campaign';
import CampaignIntro from './CampaignIntro';
import CampaignPerformance from './CampaignPerformance';
import Desk from './Desk';
import SaveProgress from './SaveProgress';
import SectorDeployment from './SectorDeployment';
import TransientNotice, { useTransientNotice } from './TransientNotice';
const BROWSER_STATE_CHANGED = 'granaderos:browser-state-changed';
function subscribeBrowserState(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener('popstate', onChange);
  window.addEventListener(BROWSER_STATE_CHANGED, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(BROWSER_STATE_CHANGED, onChange);
  };
}
function notifyBrowserStateChanged() {
  window.dispatchEvent(new Event(BROWSER_STATE_CHANGED));
}
function readSavePresence() {
  try {
    return Boolean(savedCampaign());
  } catch {
    return false;
  }
}
const readBrowserSearch = () => window.location.search;
const serverSearch = () => '';
const serverSavePresence = () => false;
const contentMode = () =>
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('content') === '1';
const storageKey = (value: CampaignSnapshot | null = null) =>
  campaignStorageKey(value, typeof window === 'undefined' ? '' : window.location.search);
function savedCampaign(value: CampaignSnapshot | null = null) {
  for (const key of campaignStorageCandidates(value, window.location.search)) {
    const raw = localStorage.getItem(key);
    if (raw) {
      return raw;
    }
  }
  return null;
}
function selectCampaignURL(id: string) {
  const url = new URL(window.location.href);
  for (const key of ['content', 'contentId', 'contentHash', 'launch']) {
    url.searchParams.delete(key);
  }
  url.searchParams.set('campaign', id);
  window.history.replaceState(null, '', url);
  notifyBrowserStateChanged();
}
function savedCampaignURL(value: CampaignSnapshot) {
  const url = new URL(window.location.href);
  url.search = campaignLaunchSearch(value, url.search);
  window.history.replaceState(null, '', url);
  notifyBrowserStateChanged();
}
export default function Home() {
  const tacticalPlaybackBusy = useRef(false);
  const audio = useRef<BattleAudio | null>(null);
  const [sound, setSound] = useState(false);
  const [campaign, setCampaign] = useState<CampaignSnapshot | null>(null);
  const [battle, setBattle] = useState<BattleSnapshot | null>(null);
  const [battleSession, setBattleSession] = useState(0);
  const [screen, setScreen] = useState('title');
  const [dialog, setDialog] = useState('');
  const [notice, setNotice] = useTransientNotice();
  const hasSave = useSyncExternalStore(subscribeBrowserState, readSavePresence, serverSavePresence);
  const browserSearch = useSyncExternalStore(
    subscribeBrowserState,
    readBrowserSearch,
    serverSearch,
  );
  const [completedLaunch, setCompletedLaunch] = useState<string | null>(null);
  const launchParameters = new URLSearchParams(browserSearch);
  const launchRequested =
    launchParameters.get('content') === '1' && launchParameters.get('launch') === '1';
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const latest = useRef({ campaign, battle, screen });
  useLayoutEffect(() => {
    latest.current = { campaign, battle, screen };
  }, [campaign, battle, screen]);
  const [introMode, setIntroMode] = useState<'new' | 'replay'>('new'),
    [introReturn, setIntroReturn] = useState('title'),
    [deskTab, setDeskTab] = useState('overview');
  const [library, setLibrary] = useState<CampaignEntry[]>([]),
    [installed, setInstalled] = useState<LoadedCampaign | null>(null),
    [selectedId, setSelectedId] = useState(''),
    [loadingCampaign, setLoadingCampaign] = useState(false),
    [campaignError, setCampaignError] = useState(''),
    [restoringRequest, setRestoring] = useState(false);
  const restoring = restoringRequest || (launchRequested && completedLaunch !== browserSearch);
  const loadSequence = useRef(0);
  const genericPresentation: Partial<CampaignPresentation> &
    Pick<CampaignPresentation, 'title' | 'edition' | 'caption'> = {
    title: campaign?.contentCampaign?.package?.name ?? 'Campaña',
    edition: 'JUEGO TÁCTICO',
    caption: 'Elegí una campaña para comenzar.',
  };
  const presentation = campaign?.contentCampaign
    ? (campaign.contentCampaign.package.presentation ?? genericPresentation)
    : (installed?.presentation ?? genericPresentation);
  const introduction = presentation.introduction;
  const canContinue = hasSave || Boolean(campaign);
  const chooseInitialCampaign = useEffectEvent((entry: CampaignEntry) =>
    chooseCampaign(entry, false),
  );
  const reportLaunchError = useEffectEvent((error: unknown) =>
    setNotice(domainRefusalMessage(error)),
  );
  useEffect(() => {
    let active = true;
    const sequence = loadSequence;
    loadCampaignRegistry()
      .then((entries) => {
        if (!active) {
          return undefined;
        }
        setLibrary(entries);
        if (!contentMode()) {
          const requested = new URLSearchParams(window.location.search).get('campaign'),
            entry =
              entries.find((item) => item.id === requested) ?? (!requested ? entries[0] : null);
          if (!entry) {
            throw Error('La campaña seleccionada no está instalada.');
          }
          return chooseInitialCampaign(entry);
        }
        return undefined;
      })
      .catch((error: unknown) => {
        if (active) {
          setCampaignError(domainRefusalMessage(error));
        }
      });
    return () => {
      active = false;
      sequence.current++;
    };
  }, []);
  useEffect(() => {
    if (!launchRequested) {
      return;
    }
    let active = true;
    void (async () => {
      try {
        const raw = sessionStorage.getItem(CONTENT_LAUNCH_KEY);
        if (!raw) {
          throw Error('Volvé al editor para iniciar una campaña con sus fichas.');
        }
        const saved = restoreGameSnapshot(raw);
        if (!saved.campaign.contentCampaign || saved.battle) {
          throw Error('Falta el contenido inicial de la campaña.');
        }
        await verifyCampaignResources(saved.campaign, { refresh: true });
        if (!active) {
          return;
        }
        savedCampaignURL(saved.campaign);
        setCampaign(saved.campaign);
        setBattle(null);
        setScreen('desk');
        sessionStorage.removeItem(CONTENT_LAUNCH_KEY);
      } catch (error) {
        if (active) {
          reportLaunchError(error);
        }
      } finally {
        if (active) {
          setCompletedLaunch(browserSearch);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [launchRequested, browserSearch]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);
  const flushSave = useCampaignAutosave(
    campaign,
    battle,
    storageKey,
    notifyBrowserStateChanged,
    (error?: Error) =>
      setNotice(
        error
          ? domainRefusalMessage(error)
          : 'No se pudo guardar en este navegador. Exportá la partida para conservarla.',
      ),
    setSaveStatus,
  );
  async function chooseCampaign(entry: CampaignEntry, clear = true) {
    const sequence = ++loadSequence.current;
    setLoadingCampaign(true);
    setCampaignError('');
    try {
      const loaded = await loadInstalledCampaign(entry);
      if (sequence !== loadSequence.current) {
        return;
      }
      if (clear) {
        flushSave();
        setCampaign(null);
        setBattle(null);
        setScreen('title');
      }
      selectCampaignURL(entry.id);
      setInstalled(loaded);
      setSelectedId(entry.id);
      notifyBrowserStateChanged();
    } catch (error) {
      if (sequence === loadSequence.current) {
        setCampaignError(domainRefusalMessage(error));
      }
    } finally {
      if (sequence === loadSequence.current) {
        setLoadingCampaign(false);
      }
    }
  }
  async function toggleSound() {
    audio.current ??= new BattleAudio();
    try {
      setSound(await audio.current.toggle());
    } catch {
      setNotice('Este navegador no pudo activar el sonido.');
    }
  }
  function commitBattle(next: BattleSnapshot, previous: BattleSnapshot | null) {
    if (next.lastError) {
      throw Error(next.lastError);
    }
    const current = latest.current;
    if (!previous || !current.battle || current.battle !== previous) {
      throw Error('El combate cambió mientras se preparaba la orden. Volvé a intentarlo.');
    }
    const spoken = withCharacterSpeech(previous, next);
    const pair = current.campaign
      ? syncBattleTime(current.campaign, spoken)
      : { campaign: null, battle: spoken, error: null };
    if (pair.error) {
      throw Error(pair.error);
    }
    // Tool calls can arrive before React renders. Commit both states together.
    latest.current = {
      ...current,
      campaign: pair.campaign,
      battle: pair.battle,
    };
    setCampaign(pair.campaign);
    setBattle(pair.battle);
    // Audio must not turn an accepted order into a reported failure.
    try {
      if (!tacticalPlaybackBusy.current) {
        audio.current?.play(current.battle, pair.battle);
      }
    } catch {}
    return pair.battle;
  }
  function updateBattle(next: BattleSnapshot) {
    try {
      return commitBattle(next, battle);
    } catch (error) {
      setNotice(domainRefusalMessage(error));
      return null;
    }
  }
  function startCampaign(destination = 'overview') {
    try {
      let content = campaign?.contentCampaign?.package ?? installed?.content ?? null;
      if (contentMode() && !content) {
        const raw = savedCampaign();
        if (raw) {
          content = restoreGameSnapshot(raw).campaign.contentCampaign?.package ?? null;
        }
      }
      if (!content) {
        throw Error('Cargá una campaña o abrí el editor de historia para comenzar.');
      }
      flushSave();
      const next = createNewGameSession(1812, content);
      savedCampaignURL(next);
      setCampaign(next);
      setBattle(null);
      setDeskTab(destination);
      setScreen('desk');
      setDialog('');
      setNotice('');
    } catch (error) {
      setNotice(domainRefusalMessage(error));
    }
  }
  function newCampaign() {
    if (!introduction?.scenes?.length) {
      startCampaign('hire');
      return;
    }
    setIntroMode('new');
    setIntroReturn('title');
    setScreen('intro');
    setDialog('');
    setNotice('');
  }
  function replayIntro() {
    if (!introduction?.scenes?.length) {
      return;
    }
    setIntroMode('replay');
    setIntroReturn(screen);
    setScreen('intro');
    setDialog('');
  }
  function completeIntro(destination: 'hire' | 'create') {
    if (introMode === 'replay') {
      setScreen(introReturn);
      return;
    }
    startCampaign(destination);
  }
  async function resume() {
    if (restoring) {
      return;
    }
    const sequence = loadSequence.current;
    setRestoring(true);
    try {
      const saved = campaign ? { campaign, battle } : restoreGameSnapshot(savedCampaign() || '');
      if (
        selectedId &&
        saved.campaign.campaignOrigin &&
        saved.campaign.campaignOrigin.id !== selectedId
      ) {
        throw Error('La partida pertenece a otra campaña.');
      }
      await verifyCampaignResources(saved.campaign, { refresh: true });
      if (sequence !== loadSequence.current) {
        return;
      }
      savedCampaignURL(saved.campaign);
      setCampaign(saved.campaign);
      setBattle(saved.battle);
      setScreen(saved.battle ? 'battle' : saved.campaign.recruited.length ? 'campaign' : 'desk');
      if (!campaign) {
        setNotice('');
      }
    } catch (e) {
      setNotice(domainRefusalMessage(e));
    } finally {
      setRestoring(false);
    }
  }

  function openCampaignBattle(state: CampaignSnapshot) {
    const pair = prepareCampaignBattle(state, { placement: true });
    if (pair.error) {
      setNotice(pair.error);
      return;
    }
    latest.current = {
      ...latest.current,
      campaign: pair.campaign,
      battle: pair.battle,
      screen: 'battle',
    };
    setCampaign(pair.campaign);
    setBattle(pair.battle);
    setScreen('battle');
  }
  function dispatch(action: CampaignAction) {
    const current = latest.current;
    if (!current.campaign) {
      return;
    }
    const needsCurrentVisit =
      action.type === 'fightOnArrival' || action.type === 'resumeSectorSession';
    const next = dispatchCampaign(current.campaign, {
      ...action,
      ...(needsCurrentVisit && current.battle ? { sectorState: current.battle } : {}),
    });
    if (next.lastError) {
      setNotice(next.lastError);
      return;
    }
    if (
      next.pendingBattle &&
      (!current.battle ||
        next.pendingBattle.id !== current.campaign?.pendingBattle?.id ||
        next.pendingBattle.resumeSnapshot)
    ) {
      openCampaignBattle(next);
      return;
    }
    const sectorSession = current.battle ? withCampaignTimeBoundary(next, current.battle) : null;
    latest.current = { ...current, campaign: next, battle: sectorSession };
    setCampaign(next);
    setBattle(sectorSession);
  }
  function continueSectorOperation() {
    const current = latest.current;
    if (!current.battle) {
      return;
    }
    try {
      commitBattle(
        runBattleJob({ battle: current.battle, kind: 'resume', action: null }),
        current.battle,
      );
    } catch (error) {
      setNotice(domainRefusalMessage(error));
    }
  }
  function talkNPC(
    npcId: string,
    approach: string,
    unitId: string,
    term?: string,
    choice?: {
      node?: string;
      id?: string;
      questResolution?: 'cash' | 'civic';
      questWithdrawal?: {
        questId: string;
        beneficiaryId?: string;
        deliveredCount: number;
      };
    },
  ) {
    const current = latest.current;
    if (!current.campaign || !current.battle || current.screen !== 'battle') {
      setNotice('Primero entrá al sector para conversar.');
      return;
    }
    try {
      const repository = new CampaignTalkToCharacterRepository(current.campaign, current.battle);
      const result = new TalkToCharacterUseCase(repository).execute({
        characterId: npcId,
        speakerId: unitId,
        approach,
        ...(term === undefined ? {} : { serviceTerm: term }),
        ...(choice?.node === undefined ? {} : { dialogueNodeId: choice.node }),
        ...(choice?.id === undefined ? {} : { dialogueChoiceId: choice.id }),
        ...(choice?.questResolution === undefined
          ? {}
          : {
              questResolution:
                choice.questResolution === 'civic' ? 'recruit' : choice.questResolution,
            }),
        ...(choice?.questWithdrawal === undefined
          ? {}
          : { questWithdrawal: choice.questWithdrawal }),
      });
      latest.current = {
        ...current,
        campaign: result.campaign,
        battle: result.sectorSession,
      };
      setCampaign(result.campaign);
      setBattle(result.sectorSession);
    } catch (error) {
      setNotice(domainRefusalMessage(error));
    }
  }
  function skirmish() {
    const config = presentation.skirmish;
    if (!config) {
      return;
    }
    flushSave();
    setCampaign(null);
    const state = createNewGameSession(1812, installed?.content ?? null);
    setBattle(
      battleFromRequest(
        {
          ...config.request,
          campaignPackage: installed?.content,
          squad: rosterFor(state)
            .filter((x) => config.operativeIds.includes(x.id))
            .map((x) => ({ ...x, horse: Boolean(config.horse) })),
        },
        state,
      ),
    );
    setScreen('battle');
    setNotice('');
  }
  function finish(outcome?: string) {
    if (campaign && battle && campaign.pendingBattle) {
      const request = campaign.pendingBattle;
      const next = dispatchCampaign(campaign, {
        type:
          outcome === 'mission'
            ? 'finishMission'
            : request.exploration
              ? 'leaveSector'
              : 'battleResult',
        battleId: request.id,
        outcome:
          outcome ||
          (battle.status === 'retreat'
            ? 'retreat'
            : battle.sectorCleared
              ? 'victory'
              : battle.status),
        sectorState: battle,
        survivors: [...battle.units, ...removedSectorCharacters(battle)]
          .filter(
            (u) =>
              u.side === 'player' &&
              request.squad.some((person) => String(person.id) === String(u.id)),
          )
          .map((u) => ({ ...u, id: Number(u.id) })),
      });
      if (next.lastError) {
        setNotice(next.lastError);
        return;
      }
      latest.current = {
        ...latest.current,
        campaign: next,
        battle: null,
        screen: 'campaign',
      };
      setCampaign(next);
      setBattle(null);
      setScreen('campaign');
    } else {
      latest.current = { ...latest.current, battle: null, screen: 'title' };
      setBattle(null);
      setScreen('title');
    }
    setDialog('');
  }
  function exportSave() {
    if (!campaign) {
      return;
    }
    try {
      const contents = encodeSave(campaign, battle),
        url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${campaign.campaignOrigin?.id ?? campaign.contentCampaign?.identity?.packageId ?? 'granaderos'}-dia-${Math.floor(campaign.hour / 24) + 1}.json`;
        a.click();
      } finally {
        URL.revokeObjectURL(url);
      }
      setNotice('Partida exportada.');
    } catch (error) {
      setNotice(domainRefusalMessage(error) || 'No se pudo exportar la partida.');
    }
  }
  async function importSave(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      if (file.size > MAX_SAVE_BYTES) {
        throw Error('El archivo de campaña es demasiado grande. El límite es de 5 MB.');
      }
      const loaded = restoreGameSnapshot(await file.text());
      setRestoring(true);
      await verifyCampaignResources(loaded.campaign, { refresh: true });
      flushSave();
      loadSequence.current++;
      setLoadingCampaign(false);
      savedCampaignURL(loaded.campaign);
      setSelectedId(loaded.campaign.campaignOrigin?.id ?? '');
      setCampaign(loaded.campaign);
      setBattle(loaded.battle);
      setBattleSession((session) => session + 1);
      setDialog('');
      setDeskTab('overview');
      setScreen(loaded.battle ? 'battle' : loaded.campaign.recruited.length ? 'campaign' : 'desk');
      setNotice('Partida recuperada.');
    } catch (error) {
      setNotice(domainRefusalMessage(error));
    } finally {
      setRestoring(false);
    }
    e.target.value = '';
  }
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) {
      return;
    }
    const lifecycle = new AbortController();
    const tools: BrowserTool[] = [
      {
        name: 'read_granaderos_state',
        title: 'Consultar campaña',
        description: 'Read the visible Granaderos campaign and tactical state.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => playerKnownState(latest.current),
      },
      {
        name: 'issue_granaderos_tactical_order',
        title: 'Dar una orden táctica',
        description:
          'Execute a tactical order for the selected patriotic squad in the active battle. move and firePoint accept tacticalLevel (0 ground, 1 upper); climb uses linkId. firePoint uses x/y and optional aim to fire at a location without confirming an occupant; omit targetId and body-region selection. throwKnife requires an actual held facon: use targetId with aim/hitLocation for a visible hostile, or x/y/tacticalLevel with aim for a point throw. Point throws use fixed torso height and can hit allies. throwGrenade requires an actual main-hand grenade and x/y/tacticalLevel; omit targetId, hitLocation and aim. It includes standing preparation and consumes one grenade. Blast can hurt allies. To bandage a visible civilian with medical supplies in hand, use useItem with targetId and targetKind npc; this approaches and uses one finite dressing. Critical first aid can restore living patients toward 15 HP, without granting energy or AP. Read treatment previews; several dressings may be needed. During arrival placement, only placeDeployment (unitIds, x, y), clearDeployment (optional unitIds), spreadDeployment and confirmDeployment are accepted. Read deployment for authorized entry cells and own squad positions; confirmDeployment starts the sector. Expected order refusals return {ok:false,error} with a player-visible reason and leave the game unchanged; accepted orders retain their turn/status/phase/units response.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'move',
                'climb',
                'useItem',
                'fire',
                'firePoint',
                'throwKnife',
                'throwGrenade',
                'reload',
                'reprime',
                'selectAmmunitionLoad',
                'unloadAmmunition',
                'melee',
                'meleePoint',
                'charge',
                'heal',
                'stance',
                'mount',
                'weapon',
                'repair',
                'ration',
                'brace',
                'overwatch',
                'artillery',
                'artilleryReload',
                'artilleryMove',
                'artilleryPivot',
                'endTurn',
                'look',
                'stealth',
                'movement',
                'rest',
                'explore',
                'transfer',
                'drop',
                'loot',
                'equipLoot',
                'throwTorch',
                'door',
                'boleadoras',
                'free',
                'prisonerEscort',
                'environment',
                'containerLoot',
                'exit',
                'fitBayonet',
                'removeBayonet',
                'weaponMode',
                'swapHands',
                'steal',
                'approachLoot',
                'lootBatch',
                'placeDeployment',
                'clearDeployment',
                'spreadDeployment',
                'confirmDeployment',
              ],
            },
            unitId: { type: 'string' },
            family: {
              type: 'string',
              enum: ['ammoMusket', 'ammoRifle', 'ammoPistol', 'ammoShot'],
            },
            unitIds: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              uniqueItems: true,
            },
            escortOrder: { type: 'string', enum: ['follow', 'wait'] },
            exitId: { type: 'string' },
            destination: { type: 'string', enum: ['inventory', 'blade'] },
            inventoryKey: { type: 'string' },
            toolKey: { type: 'string' },
            supplyKey: {
              type: 'string',
              enum: ['torches', 'boleadoras', 'rations'],
            },
            kind: { type: 'string', enum: ['door', 'container'] },
            id: { type: 'string' },
            verb: {
              type: 'string',
              enum: ['inspect', 'open', 'close', 'unlock', 'pick', 'pry', 'force', 'disarm'],
            },
            index: { type: 'integer', minimum: 0 },
            environment: {
              type: 'object',
              properties: {
                kind: { type: 'string', enum: ['door', 'container'] },
                id: { type: 'string' },
              },
              required: ['kind', 'id'],
              additionalProperties: false,
            },
            items: {
              type: 'array',
              minItems: 1,
              maxItems: 1000,
              items: {
                type: 'object',
                properties: {
                  targetId: { type: 'string' },
                  groundId: { type: 'string' },
                  dropIndex: { type: 'integer', minimum: 0 },
                  item: { type: 'string' },
                  count: { type: 'integer', minimum: 1 },
                },
                required: ['count'],
                additionalProperties: false,
              },
            },
            item: { type: 'string' },
            count: { type: 'integer', minimum: 1 },
            doorId: { type: 'string' },
            groundId: { type: 'string' },
            dropIndex: { type: 'integer', minimum: 0 },
            enabled: { type: 'boolean' },
            movement: {
              type: 'string',
              enum: ['walk', 'run', 'crouch', 'prone'],
            },
            movementIntent: {
              type: 'string',
              enum: ['forward', 'preserveFacing'],
            },
            targetId: { type: 'string' },
            targetKind: { type: 'string', enum: ['npc'] },
            linkId: { type: 'string' },
            tacticalLevel: { type: 'integer', minimum: 0, maximum: 8 },
            x: { type: 'integer' },
            y: { type: 'integer' },
            aim: { type: 'integer', minimum: 0, maximum: 4 },
            hitLocation: { type: 'string', enum: ['torso', 'head', 'legs'] },
            stance: { type: 'string', enum: ['standing', 'crouched', 'prone'] },
            slot: {
              type: 'string',
              enum: ['primary', 'blade', 'offhand', 'medical', 'tool', 'supply', 'item', 'unarmed'],
            },
            artilleryId: { type: 'string' },
            mode: {
              type: 'string',
              enum: ['solid', 'canister', 'fire', 'melee'],
            },
          },
          required: ['type'],
          additionalProperties: false,
        },
        execute: (input: unknown) => {
          const reject = (reason: string) => ({
            ok: false as const,
            error: playerKnownError(reason),
          });
          if (tacticalPlaybackBusy.current) {
            return reject('Esperá a que termine el movimiento.');
          }
          const current = latest.current.battle;
          if (!current || latest.current.screen !== 'battle') {
            return reject('No hay batalla activa.');
          }
          if (
            !input ||
            typeof input !== 'object' ||
            !('type' in input) ||
            ![
              'move',
              'climb',
              'useItem',
              'fire',
              'firePoint',
              'throwKnife',
              'throwGrenade',
              'reload',
              'reprime',
              'selectAmmunitionLoad',
              'unloadAmmunition',
              'melee',
              'meleePoint',
              'charge',
              'heal',
              'stance',
              'mount',
              'weapon',
              'repair',
              'ration',
              'brace',
              'overwatch',
              'artillery',
              'artilleryReload',
              'artilleryMove',
              'artilleryPivot',
              'endTurn',
              'look',
              'stealth',
              'movement',
              'rest',
              'explore',
              'transfer',
              'drop',
              'loot',
              'equipLoot',
              'throwTorch',
              'door',
              'boleadoras',
              'free',
              'prisonerEscort',
              'environment',
              'containerLoot',
              'exit',
              'fitBayonet',
              'removeBayonet',
              'weaponMode',
              'swapHands',
              'steal',
              'approachLoot',
              'lootBatch',
              'placeDeployment',
              'clearDeployment',
              'spreadDeployment',
              'confirmDeployment',
            ].some((type) => type === input.type)
          ) {
            return reject('Orden no válida.');
          }
          const action =
            input.type === 'endTurn'
              ? { type: 'endTurn' as const }
              : readBattleWorkerAction('action', input);
          let next;
          try {
            const resolved =
              action.type === 'endTurn' ? endTurn(current) : actBattle(current, action);
            // Admission failures are data: browser tool transports can hide thrown messages.
            // Commit faults remain exceptions and must not be reported as ordinary refusals.
            if (resolved.lastError) {
              return reject(resolved.lastError);
            }
            next = commitBattle(resolved, current);
          } catch (error) {
            throw Error(playerKnownError(domainRefusalMessage(error)));
          }
          const known = playerKnownBattle(latest.current.battle);
          if (!known) {
            throw new Error('No hay batalla activa.');
          }
          return {
            turn: next.turn,
            status: next.status,
            phase: next.phase,
            units: known.units,
            interrupt: 'interrupt' in known ? known.interrupt : null,
            ...('deployment' in known ? { deployment: known.deployment } : {}),
          };
        },
      },
    ];
    for (const tool of tools) {
      try {
        Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
      } catch {}
    }
    return () => lifecycle.abort();
  }, []);
  return (
    <main
      aria-busy={loadingCampaign || restoring}
      className={
        screen === 'intro' ? 'intro-screen' : screen === 'title' ? 'title-screen' : 'game-shell'
      }
    >
      <CampaignPerformance campaign={campaign} battle={battle} screen={screen} />
      <TransientNotice
        message={notice?.message}
        eventKey={notice?.id}
        onDismiss={() => setNotice('')}
      />
      <input
        type="file"
        ref={fileInput}
        hidden
        accept="application/json,.json"
        onChange={importSave}
      />
      {screen === 'intro' ? (
        <CampaignIntro
          content={introduction}
          replay={introMode === 'replay'}
          onComplete={completeIntro}
          onBack={() => setScreen(introReturn)}
        />
      ) : screen === 'title' ? (
        <>
          {presentation.menuArt && (
            <img
              className="title-art"
              src={sitePath(presentation.menuArt)}
              alt={presentation.menuArtAlt ?? presentation.title}
            />
          )}
          <div className="title-shade" />
          <span className="edition">{presentation.edition}</span>
          <section className="title-controls">
            <p className="eyebrow">{presentation.eyebrow}</p>
            <h1 className="sr-only">{presentation.title}</h1>
            <label className="campaign-picker">
              Campaña
              <select
                aria-label="Campaña"
                value={selectedId}
                disabled={loadingCampaign || restoring}
                onChange={(event) => {
                  const entry = library.find((item) => item.id === event.target.value);
                  if (entry) {
                    void chooseCampaign(entry);
                  }
                }}
              >
                {!selectedId && (
                  <option value="">
                    {contentMode()
                      ? (campaign?.contentCampaign?.package?.name ?? 'Contenido del editor')
                      : 'Cargando campañas…'}
                  </option>
                )}
                {library.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            {campaignError && <p role="alert">{campaignError}</p>}
            {canContinue && (
              <button
                disabled={loadingCampaign || restoring}
                className="menu-primary"
                onClick={resume}
              >
                Continuar campaña <span>→</span>
              </button>
            )}
            <button
              disabled={
                loadingCampaign ||
                restoring ||
                (!installed && !campaign?.contentCampaign && !contentMode())
              }
              className={canContinue ? 'menu-secondary' : 'menu-primary'}
              onClick={() => (canContinue ? setDialog('new') : newCampaign())}
            >
              Nueva campaña <span>→</span>
            </button>
            {presentation.skirmish && (
              <button className="menu-secondary" onClick={skirmish}>
                {presentation.skirmish.label} <span>⚔</span>
              </button>
            )}
            <a className="menu-link" href={pagePath('/studio')}>
              Estudio de campañas
            </a>
            <a
              className="menu-link"
              href={pagePath(`/story?campaign=${encodeURIComponent(selectedId || 'granaderos')}`)}
            >
              Editor de historia
            </a>
            <a
              className="menu-link"
              href={pagePath(`/editor?campaign=${encodeURIComponent(selectedId || 'granaderos')}`)}
            >
              Constructor de sectores
            </a>
            {(introduction?.scenes?.length ?? 0) > 0 && (
              <button className="menu-link" onClick={replayIntro}>
                Ver introducción
              </button>
            )}
            <button className="menu-link" onClick={() => setDialog('help')}>
              Manual de campaña
            </button>
            <button className="menu-link" onClick={() => fileInput.current?.click()}>
              Importar partida
            </button>
            <p className="title-caption">{presentation.caption}</p>
          </section>
          <footer className="title-footer">
            <span>{presentation.footer ?? 'ESTRATEGIA · TÁCTICA'}</span>
            <BuildIdentity />
          </footer>
        </>
      ) : (
        <>
          <nav className="game-nav">
            <button className="wordmark" onClick={() => setDialog('menu')} aria-label="Abrir menú">
              {presentation.title}
              <span>{presentation.period}</span>
            </button>
            <div className="nav-center">
              <span className="nav-sun">✳</span>
              {presentation.eyebrow}
            </div>
            <div className="nav-tools">
              <button
                onClick={toggleSound}
                aria-label={sound ? 'Silenciar sonido' : 'Activar sonido'}
                title={sound ? 'Silenciar sonido' : 'Activar sonido'}
              >
                {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              {campaign && (
                <div className="save-controls">
                  <button
                    onClick={exportSave}
                    title="Exportar partida"
                    aria-label="Exportar partida"
                  >
                    <Download size={18} />
                    <span>Guardar</span>
                  </button>
                  <SaveProgress
                    status={saveStatus}
                    sessionId={campaign.gameSessionId}
                    revision={campaign.gameRevision}
                  />
                </div>
              )}
              <button onClick={() => setDialog('help')} aria-label="Manual de campaña">
                <BookOpen size={18} />
              </button>
              <button onClick={() => setDialog('menu')} aria-label="Menú">
                <Menu size={20} />
              </button>
            </div>
          </nav>
          {screen === 'battle' && battle?.pendingSectorOperation && (
            <output className="sector-continuation">
              <span>La orden quedó pendiente al detenerse el tiempo.</span>
              <button
                onClick={continueSectorOperation}
                disabled={Boolean(campaign && pendingArrivalDecisions(campaign).length)}
              >
                Continuar orden
              </button>
            </output>
          )}
          {campaign &&
            screen === 'campaign' &&
            (campaign.suspendedSectorSessions ?? []).length > 0 && (
              <section aria-label="Visitas de sector abiertas" className="sector-continuation">
                <span>Volver al sector</span>
                {(campaign.suspendedSectorSessions ?? []).map((visit) => (
                  <button
                    key={visit.request.id}
                    onClick={() =>
                      dispatch({
                        type: 'resumeSectorSession',
                        sectorSessionId: visit.request.id,
                      })
                    }
                  >
                    {visit.request.name}
                  </button>
                ))}
              </section>
            )}
          {screen === 'battle' && battle ? (
            battle.deployment ? (
              <SectorDeployment
                key={battleSession}
                battle={battle}
                onChange={updateBattle}
                onMap={campaign ? () => setScreen('campaign') : undefined}
              />
            ) : (
              <Battlefield
                key={battleSession}
                campaignContext={campaign ?? installed?.content}
                onPlaybackBusy={(busy) => {
                  tacticalPlaybackBusy.current = busy;
                }}
                onPlaybackValidate={(next) => {
                  if (next.lastError) {
                    setNotice(next.lastError);
                    return false;
                  }
                  const current = latest.current,
                    pair = current.campaign ? syncBattleTime(current.campaign, next) : null;
                  if (pair?.error) {
                    setNotice(pair.error);
                    return false;
                  }
                  return true;
                }}
                onPlaybackFrame={(before, after) => {
                  try {
                    audio.current?.play(before, after);
                  } catch {}
                }}
                peacefulVisit={Boolean(campaign?.pendingBattle?.exploration)}
                mission={
                  campaign ? missionStatus(campaign, battle.sceneId ?? battle.sectorId) : null
                }
                onMissionFinish={() => finish('mission')}
                battle={battle}
                quests={
                  campaign
                    ? Object.fromEntries(
                        (battle.npcs || []).map((n) => [n.id, questForNPC(campaign, n.id)]),
                      )
                    : undefined
                }
                onMap={campaign ? () => setScreen('campaign') : undefined}
                conversation={campaign?.lastConversation}
                onTalk={campaign ? talkNPC : undefined}
                dialogues={
                  campaign
                    ? Object.fromEntries(
                        (battle.npcs || []).map((n) => [n.id, dialogueForNPC(campaign, n, battle)]),
                      )
                    : undefined
                }
                hireTerms={
                  campaign
                    ? Object.fromEntries(
                        (battle.npcs || []).map((n) => [n.id, encounterHireTerms(campaign, n)]),
                      )
                    : undefined
                }
                onChange={updateBattle}
                onFinish={() => finish()}
              />
            )
          ) : campaign && screen === 'desk' ? (
            <Desk
              key={battleSession}
              state={campaign}
              dispatch={dispatch}
              initialTab={deskTab}
              onClose={() => {
                setDeskTab('overview');
                setScreen('campaign');
              }}
            />
          ) : campaign ? (
            <Campaign
              key={battleSession}
              state={campaign}
              battle={battle}
              dispatch={dispatch}
              onOpenDesk={() => {
                setDeskTab('overview');
                setScreen('desk');
              }}
              onBattle={() => {
                if (!battle && campaign.pendingBattle) {
                  openCampaignBattle(campaign);
                } else {
                  setScreen('battle');
                }
              }}
            />
          ) : null}
        </>
      )}
      <Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && setDialog('')}>
        <DialogContent
          className={`dispatch-modal ${dialog === 'help' ? 'manual-modal' : ''}`}
          showCloseButton={false}
        >
          <p className="eyebrow">CUARTEL GENERAL</p>
          <DialogTitle>
            {dialog === 'help'
              ? 'Manual de campaña'
              : dialog === 'new'
                ? 'Comenzar una nueva campaña'
                : 'Órdenes del comandante'}
          </DialogTitle>
          <DialogDescription>
            {dialog === 'help'
              ? 'Leé el terreno, conservá la pólvora y golpeá con decisión.'
              : dialog === 'new'
                ? 'La nueva campaña reemplazará el guardado automático. Exportá la partida actual si querés conservarla.'
                : 'La campaña se guarda automáticamente en este navegador. Exportala para continuar en otro dispositivo.'}
          </DialogDescription>
          {dialog === 'help' ? (
            <div className="manual-content">
              <article>
                <h3>01 · Dirigí la campaña</h3>
                <p>
                  {presentation.manual?.campaign ??
                    'Contratá al menos un combatiente o creá un personaje. Consultá los objetivos de la campaña, explorá sus sectores y prepará a tu escuadra.'}
                </p>
              </article>
              <article>
                <h3>02 · Combatí por turnos</h3>
                <p>
                  Seleccioná un soldado y equipá un objeto con W o desde Equipo. Un clic sobre un
                  enemigo usa el arma en mano. B alterna Disparo y Combate cercano: bayoneta o
                  culatazo. F y el botón derecho respetan el modo elegido. En Disparo, el botón
                  derecho abre la mira; otro clic derecho sobre un personaje aumenta la puntería y
                  el coste en PA. Sobre el suelo, vuelve a movimiento. Apuntá a cabeza, torso o
                  piernas en la figura y dispará con clic izquierdo. Los objetivos cuerpo a tierra
                  tienen una sola zona. L permite girar al soldado y consume PA. Las heridas y el
                  cansancio reducen los PA del turno. Podés conservar hasta 5 PA para el siguiente.
                </p>
              </article>
              <article>
                <h3>03 · Dominá la avancarga</h3>
                <p>
                  Las armas disparan una vez antes de recargarse. La recarga tarda entre 7 y 17,5
                  PA; cuerpo a tierra cuesta un 50% más. La lluvia puede apagar la chispa: cebar la
                  cazoleta cuesta 3,75 PA y conserva la carga. El humo dificulta la puntería.
                </p>
              </article>
              <article>
                <h3>04 · Decidí con el sable</h3>
                <p>
                  Equipá el sable o la lanza, acercate con una orden de movimiento y seleccioná un
                  enemigo al alcance. Cada orden muestra su coste. Para atender una herida, equipá
                  vendas y seleccionate a vos, a un aliado o a un civil herido. El sanitario se
                  acerca y usa una venda. El vendaje reduce la hemorragia y estabiliza heridas
                  críticas hasta 15 de salud. Puede necesitar varias vendas. El tratamiento en
                  campaña recupera salud con tiempo y vendas.
                </p>
              </article>
              <article>
                <h3>05 · Cumplí los objetivos</h3>
                <p>
                  {presentation.manual?.goals ??
                    'Consultá los objetivos y hablá con los habitantes. Buscá armas, municiones y dinero en el terreno para sostener a tu escuadra.'}
                </p>
              </article>
              <article>
                <h3>06 · Explorá y conversá</h3>
                <p>
                  En un sector tranquilo podés desplazarte sin gastar PA, pero la energía sigue
                  siendo limitada. Acercate a una casilla contigua para hablar con los habitantes.
                  Las puertas se abren por separado; las ventanas permiten mirar. De noche, las
                  antorchas iluminan el terreno y también pueden revelar tu posición.
                </p>
              </article>
              <article>
                <h3>07 · Hojas de servicio</h3>
                <p>
                  Abrí el Escritorio desde la carta para consultar voluntarios y sus atributos. Los
                  contactos importantes se encuentran en el terreno. En la nómina, pulsá Asignación
                  para elegir una escuadra o un trabajo. El equipo y los caballos se administran en
                  el sector donde están.
                </p>
              </article>
              <article>
                <h3>08 · Órdenes de teclado</h3>
                <p>
                  1–6: seleccionar. Espacio: siguiente combatiente. W: cambiar el objeto en mano. F:
                  usarlo sobre un objetivo. B: alternar Disparo y Combate cercano. G: mover. D: fin
                  de turno o descanso. R: correr. Mayús+R: recargar o cebar. S: caminar. C:
                  agacharse. P: cuerpo a tierra. Z: sigilo. L: mirar. Botón derecho: preparar el
                  ataque elegido; en Disparo, apuntar y aumentar puntería. Clic izquierdo: confirmar
                  el ataque. Alt+clic: avanzar sin girar. Mayús+clic: seleccionar un grupo durante
                  la exploración. Un nuevo clic en el mapa cambia el destino durante la marcha. Tres
                  clics hacen correr al seleccionado desde el próximo paso. Esc detiene la marcha al
                  terminar el paso actual. Rueda o panel táctil: desplazar el mapa. Pellizco:
                  acercar o alejar. Clic en un retrato: centrar en ese combatiente. H: todos los
                  atajos. Esc: cancelar.
                </p>
              </article>
              <article>
                <h3>09 · Salí por el borde</h3>
                <p>
                  Abrí Retirada o Salir del sector. Elegí el destino y los combatientes. Deben
                  llegar al borde indicado y tener fuerzas para cruzarlo. El panel muestra el coste
                  y las causas que impiden salir. Una salida parcial deja el encuentro activo. M
                  abre la carta y conserva el despliegue durante el combate. Podés atender otra
                  escuadra y reanudar una visita abierta desde la carta de operaciones.
                </p>
              </article>
              {presentation.manual?.note && (
                <p className="manual-note">{presentation.manual.note}</p>
              )}
            </div>
          ) : dialog === 'menu' ? (
            <div className="dialog-buttons">
              {(introduction?.scenes?.length ?? 0) > 0 && (
                <button className="line-button" onClick={replayIntro}>
                  Ver introducción
                </button>
              )}
              {campaign && (
                <button className="gold-button" onClick={exportSave}>
                  <Download size={16} />
                  Exportar partida
                </button>
              )}
              <button className="line-button" onClick={() => fileInput.current?.click()}>
                Importar partida
              </button>
              <button
                className="line-button"
                onClick={() => {
                  setScreen('title');
                  setDialog('');
                }}
              >
                Volver al menú principal
              </button>
            </div>
          ) : dialog === 'new' ? (
            <button className="gold-button" onClick={newCampaign}>
              Comenzar campaña
            </button>
          ) : null}
          <BuildIdentity />
          <button className="dialog-close" onClick={() => setDialog('')}>
            {dialog === 'help' ? 'Entendido' : 'Volver'}
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
