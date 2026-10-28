'use client';
import { editorErrorMessage } from '../../../infrastructure/editor-error-message.ts';
import { useMemo, useRef, useState } from 'react';
import { Battlefield } from '../../../../web/game-preview.ts';
import {
  createCampaignSandbox,
  dispatchCampaignSandbox,
  adoptCampaignSandboxBattle,
  campaignSandboxDialogues,
  campaignSandboxActors,
  encodeCampaignSandbox,
  decodeCampaignSandbox,
} from '../../../../../packages/game/public/campaign-playtest-api.js';
import { campaignSectors } from '../../../../../packages/game/public/campaign-editor-api.js';
import { contentIdentity } from '../../../../../packages/campaign-format/content-identity.js';
import {
  contentQuestJournal,
  contentQuestStatus,
  QUEST_STATE_LABELS,
} from '../../../../../packages/game/public/campaign-editor-api.js';
import { encounterHireTerms } from '../../../../../packages/game/public/campaign-editor-api.js';
import { questForNPC, questJournal } from '../../../../../packages/game/public/campaign-editor-api.js';
import { campaignObjectives } from '../../../../../packages/game/public/campaign-editor-api.js';
import { sitePath } from '../../../../web/game-preview-assets.js';

export default function QuestSandbox({
  content,
  resolveAsset = sitePath,
}: {
  content: any;
  resolveAsset?: (reference: string) => string;
}) {
  const [sandbox, setSandbox] = useState<any>(null),
    [seed, setSeed] = useState(18130203),
    [treasury, setTreasury] = useState(''),
    [hire, setHire] = useState(''),
    [term, setTerm] = useState('day'),
    [sector, setSector] = useState(''),
    [actor, setActor] = useState(''),
    [hours, setHours] = useState(1),
    [notice, setNotice] = useState(''),
    [saveText, setSaveText] = useState(''),
    [playbackBusy, setPlaybackBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null),
    identity = useMemo(() => contentIdentity(content), [content]);
  const stale = sandbox && sandbox.sourceIdentity.hash !== identity.hash,
    sectors = campaignSectors(content),
    roster = sandbox ? campaignSandboxActors(sandbox) : [],
    candidates = roster.filter((op: any) => op.recruitmentSource === 'contract'),
    selectedHire = candidates.find((op: any) => String(op.id) === hire) ?? candidates[0],
    players = sandbox?.battle?.units.filter((u: any) => u.side === 'player') ?? [],
    unit = players.find((u: any) => u.id === actor) ?? players[0];
  let dialogues: any[] = [],
    dialogueError = '';
  try {
    if (sandbox) dialogues = campaignSandboxDialogues(sandbox);
  } catch (error: any) {
    dialogueError = editorErrorMessage(error);
  }
  const command = (action: any) => {
    if (playbackBusy) return;
    setSandbox((current: any) => dispatchCampaignSandbox(current, action));
    setSaveText('');
  };
  const npcDialogues = Object.fromEntries(
    dialogues.map(({ npc, dialogue }: any) => [npc.id, dialogue]),
  );
  const quests = sandbox
    ? Object.fromEntries(
        (sandbox.battle?.npcs ?? []).map((npc: any) => [
          npc.id,
          questForNPC(sandbox.campaign, npc.id),
        ]),
      )
    : {};
  const terms = sandbox
    ? Object.fromEntries(
        (sandbox.battle?.npcs ?? []).map((npc: any) => [
          npc.id,
          encounterHireTerms(sandbox.campaign, npc),
        ]),
      )
    : {};
  const talk = (
    npcId: string,
    approach: string,
    unitId: string,
    contractTerm?: string,
    choice?: any,
  ) =>
    command({
      type: 'talk',
      npcId,
      approach,
      unitId,
      ...(contractTerm ? { term: contractTerm } : {}),
      ...(choice?.id ? { choice: choice.id, node: choice.node } : {}),
      ...(choice?.questResolution ? { questResolution: choice.questResolution } : {}),
      ...(choice?.questWithdrawal ? { questWithdrawal: choice.questWithdrawal } : {}),
    });
  return (
    <section className="studio-quest-sandbox" aria-label="Prueba real de campaña y encargos">
      <h2>Prueba de campaña y encargos</h2>
      <p>
        La prueba usa el proyecto actual y las acciones del juego. Reclutá, viajá, entrá al sector y
        conversá. Las entregas, los costos y los plazos conservan sus reglas.
      </p>
      <fieldset>
        <legend>Configuración de prueba</legend>
        <label>
          Semilla de campaña
          <input
            type="number"
            min={0}
            max={4294967295}
            value={seed}
            onChange={(e) => setSeed(e.target.valueAsNumber)}
          />
        </label>
        <label>
          Tesorería inicial de prueba (opcional)
          <input
            type="number"
            min={0}
            max={1000000000}
            value={treasury}
            onChange={(e) => setTreasury(e.target.value)}
          />
        </label>
        <small>Este importe solo cambia el escenario de prueba. No cambia el proyecto.</small>
        <button
          type="button"
          onClick={() => {
            try {
              setSandbox(
                createCampaignSandbox(
                  content,
                  seed,
                  treasury === '' ? {} : { startingTreasury: Number(treasury) },
                ),
              );
              setNotice('Prueba iniciada desde las condiciones iniciales.');
              setSaveText('');
            } catch (error: any) {
              setNotice(editorErrorMessage(error));
            }
          }}
        >
          {sandbox ? 'Reiniciar prueba' : 'Iniciar prueba'}
        </button>
      </fieldset>
      {notice && <p role="status">{notice}</p>}
      {stale && (
        <p role="alert">El proyecto cambió. Reiniciá la prueba para usar sus nuevos datos.</p>
      )}
      {sandbox && (
        <>
          <p>
            Día {Math.floor(sandbox.campaign.hour / 24) + 1} · {sandbox.campaign.hour % 24}:
            {String(Math.floor((sandbox.campaign.secondOfHour ?? 0) / 60)).padStart(2, '0')} ·
            Tesorería: {sandbox.campaign.resources.treasury} pesos · Lugar:{' '}
            {sandbox.campaign.location}
          </p>
          {(sandbox.lastError || dialogueError) && (
            <p role="alert">{sandbox.lastError || dialogueError}</p>
          )}
          <fieldset disabled={Boolean(stale) || playbackBusy}>
            <legend>Acciones reales</legend>
            <label>
              Candidato de prueba
              <select
                value={String(selectedHire?.id ?? '')}
                onChange={(e) => setHire(e.target.value)}
              >
                {candidates.map((op: any) => (
                  <option value={op.id} key={op.id}>
                    {op.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Plazo de prueba
              <select value={term} onChange={(e) => setTerm(e.target.value)}>
                <option value="day">Un día</option>
                <option value="week">Una semana</option>
                <option value="fortnight">Quince días</option>
                <option value="month">Un mes</option>
              </select>
            </label>
            <button
              type="button"
              disabled={!selectedHire || Boolean(sandbox.battle)}
              onClick={() =>
                command({ type: 'recruitCombatant', characterId: selectedHire.id, term })
              }
            >
              Reclutar candidato
            </button>
            <label>
              Destino de prueba
              <select
                value={sector || sandbox.campaign.location}
                onChange={(e) => setSector(e.target.value)}
              >
                {sectors.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={Boolean(sandbox.battle)}
              onClick={() =>
                command({ type: 'travel', sector: sector || sandbox.campaign.location })
              }
            >
              Viajar al destino
            </button>
            <button
              type="button"
              disabled={Boolean(sandbox.battle)}
              onClick={() => command({ type: 'enter' })}
            >
              Entrar al sector actual
            </button>
            <button
              type="button"
              disabled={Boolean(sandbox.battle)}
              onClick={() =>
                command({ type: 'attack', sector: sector || sandbox.campaign.location })
              }
            >
              Atacar el destino
            </button>
            <label>
              Horas de prueba
              <input
                type="number"
                min={1}
                max={24}
                value={hours}
                onChange={(e) => setHours(e.target.valueAsNumber)}
              />
            </label>
            <button type="button" onClick={() => command({ type: 'wait', hours })}>
              Volver a estrategia y esperar
            </button>
            <p>
              Esperar sale de una visita abierta y usa el reloj estratégico. Durante un combate,
              terminá la batalla primero.
            </p>
            {sandbox.battle && (
              <>
                <label>
                  Combatiente de prueba
                  <select value={unit?.id ?? ''} onChange={(e) => setActor(e.target.value)}>
                    {players.map((u: any) => (
                      <option value={u.id} key={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => command({ type: 'tactical', order: { type: 'endTurn' } })}
                >
                  Avanzar el turno táctico
                </button>
              </>
            )}
          </fieldset>
          {dialogues.map(({ npc, dialogue, choices }: any) => (
            <fieldset key={npc.id} disabled={Boolean(stale) || playbackBusy}>
              <legend>
                {npc.name} · {dialogue.node}
              </legend>
              {npc.portrait && (
                <img width={64} height={64} src={resolveAsset(npc.portrait)} alt={npc.name} />
              )}
              <p>{dialogue.text}</p>
              <button
                type="button"
                disabled={!unit}
                onClick={() => command({ type: 'approach', unitId: unit.id, npcId: npc.id })}
              >
                Acercarse a {npc.name}
              </button>
              <button
                type="button"
                disabled={!unit}
                onClick={() => talk(npc.id, 'dialogue', unit.id)}
              >
                Hablar con {npc.name}
              </button>
              {choices.map(({ choice, conditions, available }: any) => (
                <div key={choice.id}>
                  <p>{choice.label}</p>
                  {conditions.map(({ condition, met }: any, index: number) => (
                    <p key={index}>
                      Condición {index + 1}: {met ? 'Cumplida' : 'No cumplida'} ·{' '}
                      {JSON.stringify(condition)}
                    </p>
                  ))}
                  {available?.effectLabel && <p>{available.effectLabel}</p>}
                  {available?.reason && <p>{available.reason}</p>}
                  <button
                    type="button"
                    disabled={!unit || !available || available.available === false}
                    onClick={() =>
                      command({
                        type: 'talk',
                        unitId: unit.id,
                        npcId: npc.id,
                        node: dialogue.node,
                        choice: choice.id,
                      })
                    }
                  >
                    Elegir: {choice.label}
                  </button>
                </div>
              ))}
            </fieldset>
          ))}
          <section aria-label="Estado de encargos de la prueba">
            <h3>Encargos</h3>
            {(content.quests ?? []).map((quest: any) => (
              <p key={quest.id}>
                {quest.title}:{' '}
                {
                  QUEST_STATE_LABELS[
                    contentQuestStatus(
                      sandbox.campaign,
                      quest.id,
                    ) as keyof typeof QUEST_STATE_LABELS
                  ]
                }
              </p>
            ))}
            {contentQuestJournal(sandbox.campaign)
              .filter((q: any) => q.remainingMinutes !== null)
              .map((q: any) => (
                <p key={q.id}>
                  {q.title}:{' '}
                  {q.expired ? 'Plazo vencido' : `${q.remainingMinutes} minutos hasta el plazo`}
                </p>
              ))}
            {questJournal(sandbox.campaign).map((q: any) => (
              <p key={q.id}>
                {q.title ?? q.id}: {q.status}
              </p>
            ))}
            {campaignObjectives(sandbox.campaign).map((chapter: any, index: number) => (
              <p key={index}>
                {chapter.name}: {chapter.objective} ·{' '}
                {chapter.complete ? 'Cumplido' : chapter.active ? 'Actual' : 'Pendiente'}
              </p>
            ))}
          </section>
          {sandbox.battle && !stale && (
            <Battlefield
              battle={sandbox.battle}
              campaignContext={sandbox.campaign}
              onPlaybackBusy={setPlaybackBusy}
              onPlaybackValidate={(battle) => {
                const next = adoptCampaignSandboxBattle(sandbox, battle);
                if (next.lastError) {
                  setNotice(next.lastError);
                  return false;
                }
                return true;
              }}
              peacefulVisit={Boolean(sandbox.campaign.pendingBattle?.exploration)}
              onChange={(battle) =>
                setSandbox((current: any) => adoptCampaignSandboxBattle(current, battle))
              }
              onFinish={() => command({ type: 'finish' })}
              conversation={sandbox.campaign.lastConversation}
              dialogues={npcDialogues}
              hireTerms={terms}
              quests={quests}
              onTalk={talk}
            />
          )}
          <details>
            <summary>Recibos y resultados de la prueba</summary>
            <pre>
              {JSON.stringify(
                {
                  quests: sandbox.campaign.contentQuestEvents ?? [],
                  events: sandbox.campaign.campaignEventState?.receipts ?? [],
                  conversations: sandbox.campaign.conversations ?? {},
                  errands: sandbox.campaign.quests ?? [],
                  history: sandbox.history,
                },
                null,
                2,
              )}
            </pre>
          </details>
          <div className="toolbar">
            <button
              type="button"
              disabled={playbackBusy || Boolean(stale)}
              onClick={() => {
                try {
                  const text = encodeCampaignSandbox(sandbox);
                  decodeCampaignSandbox(text, content);
                  setSaveText(text);
                  setNotice('Prueba guardada y comprobada con el lector de partidas.');
                } catch (error: any) {
                  setNotice(editorErrorMessage(error));
                }
              }}
            >
              Guardar prueba y comprobar
            </button>
            <button type="button" onClick={() => importRef.current?.click()}>
              Recuperar prueba
            </button>
          </div>
          {saveText && (
            <>
              <a
                download="prueba-campaña.json"
                href={`data:application/json;charset=utf-8,${encodeURIComponent(saveText)}`}
              >
                Descargar prueba
              </a>
              <label>
                Partida de prueba
                <textarea rows={6} readOnly value={saveText} />
              </label>
            </>
          )}
        </>
      )}
      <input
        type="file"
        hidden
        ref={importRef}
        accept="application/json,.json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            if (file.size > 50000000) throw Error('La prueba supera 50 MB.');
            setSandbox(decodeCampaignSandbox(await file.text(), content));
            setNotice('Prueba recuperada con sus recibos.');
          } catch (error: any) {
            setNotice(editorErrorMessage(error));
          }
        }}
      />
    </section>
  );
}
