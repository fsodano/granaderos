'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export default function StrategicPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- Native dialog Escape handling and its close button provide keyboard dismissal.
    <dialog
      ref={dialog}
      className="strategic-panel-dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          onClose();
        }
      }}
    >
      <header>
        <h2>{title}</h2>
        <button className="line-button" aria-label="Cerrar panel de campaña" onClick={onClose}>
          Cerrar ×
        </button>
      </header>
      <div className="strategic-panel-body">{children}</div>
    </dialog>
  );
}
