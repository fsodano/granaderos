'use client';

import type {
  CampaignSnapshot,
  CampaignOperative,
  CampaignAttentionNotice,
} from '../../../packages/game/public/campaign-types.ts';
import { useState } from 'react';
import {
  publicAssignmentNotice,
  assignmentAttentionText,
} from '../../../packages/game/assignment-attention.js';
import './assignment-attention.css';

type Props = { state: CampaignSnapshot; roster: CampaignOperative[] };

function AssignmentNotice({
  state,
  roster,
  notice,
  reported,
}: Props & {
  notice: Omit<CampaignAttentionNotice, 'events'> & {
    events: Omit<CampaignAttentionNotice['events'][number], 'binding'>[];
  };
  reported: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [previousReported, setPreviousReported] = useState(reported);
  if (previousReported !== reported) {
    setPreviousReported(reported);
    if (reported) {
      setDismissed(false);
    }
  }
  // A repaired assignment can later pause again with the same text and hour.
  // Keep the old notice closed while its marker is cleared; show a new report.
  if (dismissed) {
    return null;
  }
  return (
    <section
      className="assignment-attention"

      aria-live="polite"
      aria-atomic="true"
      aria-label="Avance detenido por asignaciones"
    >
      <div className="assignment-attention-heading">
        <div>
          <h2>Avance detenido por asignaciones</h2>
          <span className="assignment-attention-time">
            Día {Math.floor(notice.hour / 24) + 1} · {String(notice.hour % 24).padStart(2, '0')}:00
          </span>
        </div>
        <button
          type="button"
          className="assignment-attention-dismiss"
          aria-label="Cerrar aviso de asignaciones"
          onClick={() => setDismissed(true)}
        >
          Cerrar <span aria-hidden="true">×</span>
        </button>
      </div>
      <p>
        Tiempo avanzado:{' '}
        <strong>
          {notice.advancedHours} de {notice.requestedHours}{' '}
          {notice.requestedHours === 1 ? 'hora solicitada' : 'horas solicitadas'}
        </strong>
        .
      </p>
      <ul>
        {notice.events.map((event) => (
          <li key={event.subject}>{assignmentAttentionText(state, event, roster)}</li>
        ))}
      </ul>
      <p className="assignment-attention-resume">
        Al pulsar <strong>Iniciar</strong> de nuevo, comienza un nuevo período desde la hora actual.
      </p>
    </section>
  );
}

export default function AssignmentAttention(props: Props) {
  const notice = publicAssignmentNotice(props.state);
  const record = props.state.assignmentAttention?.notice;
  const reported =
    record?.events.every((event) => {
      const marker = props.state.assignmentAttention.reported[event.subject];
      return marker?.binding === event.binding && marker?.code === event.code;
    }) ?? false;
  // Dismissal belongs to this notice, not to a cloned campaign state or the clock.
  return notice ? (
    <AssignmentNotice key={JSON.stringify(record)} {...props} notice={notice} reported={reported} />
  ) : null;
}
