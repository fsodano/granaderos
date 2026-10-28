import type {
  SaveState,
  SaveStatus,
} from '../../../packages/game/application/get-save-status/get-save-status.repository.ts';
import './save-progress.css';

const SAVE_LABELS: Record<SaveState, string> = {
  unsaved: 'Sin guardar',
  saving: 'Guardando…',
  saved: 'Guardado',
  blocked: 'Guardado bloqueado',
  failed: 'Error al guardar',
};

type SaveProgressProps = Readonly<{
  status: SaveStatus | null;
  sessionId: string;
  revision: number;
}>;

export default function SaveProgress({ status, sessionId, revision }: SaveProgressProps) {
  const current =
    status?.accepted?.sessionId === sessionId && status.accepted.revision === revision;
  const state = current ? status.state : 'unsaved';
  const message = current ? status.message : null;
  const needsExport = state === 'failed' || state === 'blocked';
  const description = needsExport
    ? `${message ?? 'El navegador no pudo guardar la partida.'} Exportá la partida para conservarla.`
    : 'Guardado automático en este navegador.';

  return (
    <span
      className="save-progress"
      data-save-state={state}
      role="status"
      aria-live="polite"
      title={description}
    >
      {SAVE_LABELS[state]}
    </span>
  );
}
