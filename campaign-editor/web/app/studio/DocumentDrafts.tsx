'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react';

export type StagedDocument = { text: string; base: string };
type Drafts = Record<string, StagedDocument>;
type Store = {
  scope: string;
  drafts: Drafts;
  setDrafts: Dispatch<SetStateAction<Drafts>>;
};
const DocumentDraftContext = createContext<Store | null>(null);

/** Unapplied text is UI state, not a campaign document or a gameplay save. */
export function DocumentDraftProvider({ scope, children }: { scope: string; children: ReactNode }) {
  const parent = useContext(DocumentDraftContext);
  const [drafts, setDrafts] = useState<Drafts>({});
  const dirty = Object.keys(drafts).length > 0;
  useEffect(() => {
    if (parent || !dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [parent, dirty]);
  // Embedded editors keep the Studio owner instead of creating a competing store.
  return parent ? (
    children
  ) : (
    <DocumentDraftContext.Provider value={{ scope, drafts, setDrafts }}>
      {children}
    </DocumentDraftContext.Provider>
  );
}

export function useDocumentDraftStore() {
  return useContext(DocumentDraftContext);
}
export const documentDraftKey = (scope: string, path: string) => `${scope}:${path}`;

export function DocumentDraftStatus({ onOpen }: { onOpen: () => void }) {
  const store = useDocumentDraftStore();
  if (!store) return null;
  const count = Object.keys(store.drafts).filter((key) => key.startsWith(`${store.scope}:`)).length;
  const total = Object.keys(store.drafts).length;
  if (!total) return null;
  return (
    <div className="studio-staged-notice" role="status">
      {count ? (
        <>
          <span>
            {count}{' '}
            {count === 1
              ? 'documento tiene texto sin aplicar'
              : 'documentos tienen texto sin aplicar'}
            . El guardado y las descargas usan los últimos datos aplicados.
          </span>
          <button type="button" onClick={onOpen}>
            Revisar documentos
          </button>
        </>
      ) : (
        <span>
          Hay texto sin aplicar en otro proyecto abierto. Volvé a ese proyecto antes de cerrar el
          estudio.
        </span>
      )}
    </div>
  );
}
