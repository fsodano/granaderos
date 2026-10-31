'use client';

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import './transient-notice.css';

type Notice = { message: string; id: number };
type Props = {
  message?: string | null | undefined;
  eventKey?: string | number | object | undefined;
  onDismiss?: (() => void) | undefined;
  durationMs?: number;
};

export function noticeText(message: string) {
  return message === 'Destino inaccesible o puntos de acción insuficientes.'
    ? 'Sin ruta o sin PA.'
    : message;
}

export function useTransientNotice() {
  const [notice, set] = useState<Notice | null>(null);
  const sequence = useRef(0);
  const setNotice = useCallback((message: string) => {
    set(message ? { message, id: ++sequence.current } : null);
  }, []);
  return [notice, setNotice] as const;
}

export default function TransientNotice({
  message,
  eventKey,
  onDismiss,
  durationMs = 4000,
}: Props) {
  const [display, setDisplay] = useState({
    message,
    eventKey,
    visible: Boolean(message),
    sequence: 0,
  });
  if (display.message !== message || display.eventKey !== eventKey) {
    setDisplay({ message, eventKey, visible: Boolean(message), sequence: display.sequence + 1 });
  }
  const dismiss = useEffectEvent(() => onDismiss?.());
  const activeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = setTimeout(() => {
      activeTimer.current = null;
      setDisplay((previous) => ({ ...previous, visible: false }));
      dismiss();
    }, durationMs);
    activeTimer.current = timer;
    return () => {
      clearTimeout(timer);
      if (activeTimer.current === timer) {
        activeTimer.current = null;
      }
    };
  }, [message, eventKey, durationMs]);
  if (!message || !display.visible) {
    return null;
  }
  const text = noticeText(message);
  return (
    <output
      className="transient-notice"

      aria-live="polite"
      aria-atomic="true"
    >
      <span key={display.sequence} title={text !== message ? message : undefined}>
        {text}
      </span>
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={() => {
          if (activeTimer.current !== null) {
            clearTimeout(activeTimer.current);
            activeTimer.current = null;
          }
          setDisplay((previous) => ({ ...previous, visible: false }));
          onDismiss?.();
        }}
      >
        <span aria-hidden="true">×</span>
      </button>
    </output>
  );
}
