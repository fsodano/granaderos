import { useEffect, useId, useRef, type ReactNode } from 'react';
import './editor-dialog.css';

export default function EditorDialog({
  open,
  onClose,
  title,
  description,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  className: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
    }
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className={`campaign-editor-dialog ${className}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={onClose}
    >
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{description}</p>
      {children}
    </dialog>
  );
}
