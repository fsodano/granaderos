'use client';
import type { CampaignProjectValidation } from '../../../application/validate-campaign-project/validate-campaign-project.use-case.ts';
import {
  assertCampaignContent,
  requireJsonDocument,
  documentString,
} from '../../lib/editor-documents.ts';
import { assertCampaignProjectEnvelope } from '../../../domain/project-document.ts';
import { editorErrorMessage } from '../../../infrastructure/editor-error-message.ts';
import {
  Component,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CampaignProject, type CampaignProjectDocument } from '../../../domain/campaign-project.ts';
import { CampaignProjectEditingRepository } from '../../../infrastructure/campaign-project-editing-repository.ts';
import { EditCampaignProjectUseCase } from '../../../application/edit-campaign-project/edit-campaign-project.use-case.ts';
import { UndoCampaignProjectEditUseCase } from '../../../application/undo-campaign-project-edit/undo-campaign-project-edit.use-case.ts';
import { RedoCampaignProjectEditUseCase } from '../../../application/redo-campaign-project-edit/redo-campaign-project-edit.use-case.ts';
import { ValidateCampaignProjectUseCase } from '../../../application/validate-campaign-project/validate-campaign-project.use-case.ts';
import { createCampaignProject } from '../../../infrastructure/create-project.js';
import {
  projectContent,
  renameCampaignProject,
  updateProjectContent,
} from '../../../infrastructure/project-operations.js';
import { validateCampaignProject } from '../../../infrastructure/project-validation.js';
import {
  decodeCampaignProject,
  exportCampaignArchive,
  importCampaignArchive,
  importCampaignFiles,
  loadInstalledCampaignProject,
} from '../../lib/campaign-studio-files.ts';
import { loadCampaignRegistry, type CampaignEntry } from '../../lib/campaign-library.ts';
import {
  saveStudioProject,
  loadStudioProjects,
  deleteStudioProject,
} from '../../lib/campaign-studio-storage.ts';
import { useStudioAssetResolver } from '../../lib/campaign-studio-assets.ts';
import { pagePath } from '../../../../web/game-preview-assets.js';
import WorldWorkspace from './WorldWorkspace.tsx';
import MapWorkspace from './MapWorkspace.tsx';
import BuildingWorkspace from './BuildingWorkspace.tsx';
import ContentWorkspace from './ContentWorkspace.tsx';
import PresentationWorkspace from './PresentationWorkspace.tsx';
import AssetsWorkspace from './AssetsWorkspace.tsx';
import QuestSandbox from './QuestSandbox.tsx';
import ContentEditor from '../story/ContentEditor.tsx';
import FieldEditor, { DocumentEditor } from './FieldEditor';
import StudioNavigation, { STUDIO_SECTIONS, type StudioSection } from './StudioNavigation';
import { DocumentDraftProvider, DocumentDraftStatus } from './DocumentDrafts.tsx';
import {
  FolderOpen,
  ArrowUpRight,
  Undo2,
  Redo2,
  Download,
  PackageCheck,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import '../editor-tools.css';
import './studio.css';

const LAST_PROJECT = 'granaderos.studio.last-project.v1';
const sections = [
  ['project', 'Proyecto'],
  ['world', 'Mundo'],
  ['maps', 'Mapas tácticos'],
  ['buildings', 'Edificios'],
  ['content', 'Historia y personajes'],
  ['presentation', 'Presentación'],
  ['assets', 'Recursos'],
  ['tests', 'Pruebas'],
  ['package', 'Validación y descarga'],
  ['documents', 'Todos los documentos'],
] as const;
type Section = StudioSection;
class PanelBoundary extends Component<
  { children: ReactNode; onRecover: () => void; resetKey: CampaignProjectDocument },
  { error: string }
> {
  override state: { error: string; resetKey: CampaignProjectDocument | null } = {
    error: '',
    resetKey: null,
  };
  static getDerivedStateFromError(error: Error) {
    return { error: editorErrorMessage(error) };
  }
  static getDerivedStateFromProps(
    props: { resetKey: CampaignProjectDocument },
    state: { resetKey: CampaignProjectDocument | null },
  ) {
    return props.resetKey === state.resetKey ? null : { error: '', resetKey: props.resetKey };
  }
  override render() {
    return this.state.error ? (
      <section role="alert">
        <h2>Este panel necesita datos válidos</h2>
        <p>{this.state.error}</p>
        <p>El borrador se conserva. Corregí los campos del documento o usá Deshacer.</p>
        <button onClick={this.props.onRecover}>Abrir todos los documentos</button>
      </section>
    ) : (
      this.props.children
    );
  }
}
function download(bytes: string | Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(
    new Blob([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], {
      type,
    }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function issueSection(section: string): Section {
  return section === 'manifest' || section === 'project'
    ? 'project'
    : section === 'package'
      ? 'package'
      : (sections.find(([key]) => key === section)?.[0] ?? 'package');
}

export default function CampaignStudio() {
  const [editingRepository] = useState(() => new CampaignProjectEditingRepository());
  const editProject = useMemo(
    () => new EditCampaignProjectUseCase(editingRepository),
    [editingRepository],
  );
  const undoProject = useMemo(
    () => new UndoCampaignProjectEditUseCase(editingRepository),
    [editingRepository],
  );
  const redoProject = useMemo(
    () => new RedoCampaignProjectEditUseCase(editingRepository),
    [editingRepository],
  );
  const validateProject = useMemo(
    () =>
      new ValidateCampaignProjectUseCase(editingRepository, { validate: validateCampaignProject }),
    [editingRepository],
  );
  const [history, setHistory] = useState(() => editingRepository.snapshot()),
    [section, setSection] = useState<Section>('project'),
    [projects, setProjects] = useState<CampaignProjectDocument[]>([]),
    [library, setLibrary] = useState<CampaignEntry[]>([]),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(''),
    [notice, setNotice] = useState(''),
    [managerOpen, setManagerOpen] = useState(true),
    [saved, setSaved] = useState(''),
    [validation, setValidation] = useState<{
      project: CampaignProjectDocument;
      report: CampaignProjectValidation;
    } | null>(null),
    [newId, setNewId] = useState('my-campaign'),
    [newName, setNewName] = useState('Mi campaña'),
    [createId, setCreateId] = useState('my-campaign'),
    [createName, setCreateName] = useState('Mi campaña'),
    [forkId, setForkId] = useState(''),
    [forkName, setForkName] = useState(''),
    [pendingImport, setPendingImport] = useState<CampaignProjectDocument | null>(null),
    [testTab, setTestTab] = useState('campaign');
  const project = history.current,
    currentRef = useRef(project),
    saveSequence = useRef(0),
    validationSequence = useRef(0),
    fileRef = useRef<HTMLInputElement>(null),
    folderRef = useRef<HTMLInputElement>(null);
  const report = validation?.project === project ? validation.report : null;
  const checking = project !== null && validation?.project !== project;
  const resolveAsset = useStudioAssetResolver(project);
  const publishEdit = useCallback(() => {
    const accepted = editingRepository.snapshot();
    currentRef.current = accepted.current;
    setHistory(accepted);
    setSaved('Cambios pendientes');
  }, [editingRepository]);
  const change = useCallback(
    (document: CampaignProjectDocument) => {
      if (!project) {
        return;
      }
      try {
        editProject.execute({
          projectId: project.manifest.id,
          revision: history.revision,
          edit: { kind: 'replace-draft', document },
        });
        publishEdit();
      } catch (error) {
        setNotice(editorErrorMessage(error));
      }
    },
    [editProject, project, history.revision, publishEdit],
  );
  const undo = useCallback(() => {
    const current = editingRepository.snapshot();
    if (!current.current) {
      return;
    }
    undoProject.execute({ projectId: current.current.manifest.id, revision: current.revision });
    publishEdit();
  }, [editingRepository, undoProject, publishEdit]);
  const redo = useCallback(() => {
    const current = editingRepository.snapshot();
    if (!current.current) {
      return;
    }
    redoProject.execute({ projectId: current.current.manifest.id, revision: current.revision });
    publishEdit();
  }, [editingRepository, redoProject, publishEdit]);
  const remember = useCallback((next: CampaignProjectDocument) => {
    setProjects((current) =>
      [...current.filter((p) => p.manifest.id !== next.manifest.id), next].sort((a, b) =>
        a.manifest.id.localeCompare(b.manifest.id),
      ),
    );
  }, []);
  function open(next: CampaignProjectDocument) {
    setManagerOpen(false);
    editingRepository.open(new CampaignProject(next));
    publishEdit();
    setValidation(null);
    setSaved('Cambios pendientes');
    setSection('project');
    setNewId(next.manifest.id);
    setNewName(documentString(next.manifest['name']));
    setForkId(`${next.manifest.id}-copy`.slice(0, 80));
    setForkName(`${documentString(next.manifest['name'])} — copia`.slice(0, 100));
  }
  const openRecoveredProject = useEffectEvent(open);
  useEffect(() => {
    let active = true;
    void (async () => {
      const results = await Promise.allSettled([loadStudioProjects(), loadCampaignRegistry()]);
      if (!active) {
        return;
      }
      const drafts = results[0].status === 'fulfilled' ? results[0].value : [];
      setProjects(drafts);
      if (results[1].status === 'fulfilled') {
        setLibrary(results[1].value);
      }
      const errors = results
        .filter((r) => r.status === 'rejected')
        .map((r) => editorErrorMessage(r.reason));
      if (errors.length) {
        setNotice(errors.join(' '));
      }
      let last = '';
      try {
        last = localStorage.getItem(LAST_PROJECT) ?? '';
      } catch {}
      const previous = drafts.find((p) => p.manifest.id === last);
      if (previous) {
        openRecoveredProject(previous);
        setNotice('Borrador recuperado con sus documentos y recursos.');
      }
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!project) {
      return;
    }
    const sequence = ++saveSequence.current;
    const timer = setTimeout(() => {
      void saveStudioProject(project)
        .then(() => {
          remember(project);
          if (sequence !== saveSequence.current) {
            return;
          }
          setSaved('Guardado en este navegador');
          try {
            localStorage.setItem(LAST_PROJECT, project.manifest.id);
          } catch {}
        })
        .catch((error) => {
          if (sequence === saveSequence.current) {
            setSaved(`Error de guardado: ${editorErrorMessage(error)}`);
          }
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [project, remember]);
  useEffect(() => {
    const sequence = ++validationSequence.current;
    if (!project) {
      return;
    }
    const timer = setTimeout(() => {
      void validateProject
        .execute({ projectId: project.manifest.id })
        .then((result) => {
          if (sequence === validationSequence.current && result.revision === history.revision) {
            setValidation({ project, report: result });
          }
        })
        .catch((error) => {
          if (sequence === validationSequence.current) {
            setValidation({
              project,
              report: {
                valid: false,
                issues: [{ section: 'project', message: editorErrorMessage(error) }],
              },
            });
          }
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [project, history.revision, validateProject]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.matches('input,textarea,select') || target.isContentEditable)
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (currentRef.current) {
          download(
            JSON.stringify(currentRef.current, null, 2),
            `${currentRef.current.manifest.id}.project.json`,
            'application/json',
          );
        }
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [undo, redo]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (saved === 'Cambios pendientes' || saved.startsWith('Error')) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [saved]);
  async function run(label: string, operation: () => Promise<void>) {
    setBusy(label);
    setNotice('');
    try {
      if (currentRef.current) {
        await saveStudioProject(currentRef.current);
      }
      await operation();
    } catch (error) {
      setNotice(editorErrorMessage(error));
    } finally {
      setBusy('');
    }
  }
  async function acceptImport(next: CampaignProjectDocument) {
    if (projects.some((p) => p.manifest.id === next.manifest.id)) {
      setPendingImport(next);
      setForkId(`${next.manifest.id}-copy`.slice(0, 80));
      setForkName(documentString(next.manifest['name']));
      setNotice('Esta identidad ya tiene un borrador. Importá una copia con otra identidad.');
    } else {
      open(next);
      setNotice('Proyecto importado.');
    }
  }
  async function importFiles(files: File[], folder = false) {
    await run('Importando proyecto', async () => {
      if (folder) {
        const records = await Promise.all(
          files.map(async (file) => ({
            path: file.webkitRelativePath || file.name,
            bytes: new Uint8Array(await file.arrayBuffer()),
            type: file.type,
          })),
        );
        await acceptImport(await importCampaignFiles(records));
      } else {
        const file = files[0];
        if (!file) {
          return;
        }
        if (file.size > 268435456) {
          throw Error('El archivo supera el límite del estudio.');
        }
        await acceptImport(
          file.name.toLowerCase().endsWith('.zip')
            ? await importCampaignArchive(new Uint8Array(await file.arrayBuffer()))
            : decodeCampaignProject(await file.text()),
        );
      }
    });
  }
  const compiled = useMemo(() => {
    if (!project) {
      return null;
    }
    try {
      if (report?.valid && report.content) {
        return report.content;
      }
      const content = projectContent(project);
      assertCampaignContent(content);
      return content;
    } catch {
      return null;
    }
  }, [project, report]);
  const valid = Boolean(report?.valid && !checking);
  function fork(source: CampaignProjectDocument) {
    if (projects.some((p) => p.manifest.id === forkId) || forkId === 'granaderos') {
      throw Error('Usá una identidad nueva para la copia.');
    }
    const historical = source.manifest['scenario'] === 'granaderos-historical-v1';
    open(renameCampaignProject(source, forkId, forkName));
    setPendingImport(null);
    setNotice(
      historical
        ? 'Copia creada con reglas genéricas. Definí sus capítulos y objetivos. Agregá posiciones de jugadores y enemigos en cada mapa. Reemplazá o quitá el combate de muestra para usar las identidades de los nuevos personajes. El informe indica las correcciones necesarias.'
        : 'Copia creada.',
    );
  }
  function rename() {
    if (!project) {
      return;
    }
    try {
      if (newId !== project.manifest.id && projects.some((p) => p.manifest.id === newId)) {
        throw Error('Esta identidad ya tiene un borrador.');
      }
      if (newId === 'granaderos' && project.manifest.id !== 'granaderos') {
        throw Error('Granaderos es una identidad reservada.');
      }
      editProject.execute({
        projectId: project.manifest.id,
        revision: history.revision,
        edit: { kind: 'rename', identifier: newId, name: newName },
      });
      publishEdit();
      setNotice('Identidad actualizada. El borrador anterior se conserva.');
    } catch (error) {
      setNotice(editorErrorMessage(error));
    }
  }
  const projectPanel = project && (
    <>
      <h2>Proyecto de campaña</h2>
      <p>
        Todo lo que creás se guarda en este proyecto. Elegí una etapa para continuar; podés volver a
        cualquier herramienta cuando lo necesites.
      </p>
      <div className="studio-overview" aria-label="Contenido del proyecto">
        <div>
          <strong>
            {Array.isArray(project.world['sectors']) ? project.world['sectors'].length : 0}
          </strong>
          <span>Localidades</span>
        </div>
        <div>
          <strong>{Object.keys(project.maps).length}</strong>
          <span>Mapas tácticos</span>
        </div>
        <div>
          <strong>
            {Array.isArray(project.content['characters'])
              ? project.content['characters'].length
              : 0}
          </strong>
          <span>Personajes</span>
        </div>
        <div>
          <strong>{Object.keys(project.resources).length}</strong>
          <span>Archivos de recursos</span>
        </div>
      </div>
      <div className="studio-next-steps" aria-label="Etapas de creación">
        {(['world', 'content', 'presentation', 'package'] as const).map((id, index) => {
          const item = STUDIO_SECTIONS.find((item) => item.id === id);
          if (!item) {
            return null;
          }
          return (
            <button type="button" key={id} onClick={() => setSection(id)}>
              <span className="studio-step-number">0{index + 1}</span>
              <item.icon size={20} aria-hidden="true" />
              <strong>{item.label}</strong>
              <span>{item.description}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <section className="studio-card">
        <h3>Datos del proyecto</h3>
        <p className="studio-muted">
          El nombre se muestra a los jugadores. La identidad distingue sus archivos y partidas
          guardadas.
        </p>
        <div className="studio-form-grid">
          <label>
            Identidad nueva
            <input value={newId} onChange={(e) => setNewId(e.target.value)} />
          </label>
          <label>
            Nombre nuevo
            <input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </label>
          <button onClick={rename}>Aplicar identidad y nombre</button>
        </div>
        <details>
          <summary>Formato y archivos del paquete</summary>
          <FieldEditor
            value={project.manifest}
            label="Manifiesto y revisión"
            path="manifest"
            onChange={(manifest) => change(assertCampaignProjectEnvelope({ ...project, manifest }))}
          />
        </details>
      </section>
      <section className="studio-card">
        <h3>Crear una copia</h3>
        <div className="studio-form-grid">
          <label>
            Identidad de copia
            <input value={forkId} onChange={(e) => setForkId(e.target.value)} />
          </label>
          <label>
            Nombre de copia
            <input value={forkName} onChange={(e) => setForkName(e.target.value)} />
          </label>
          <button
            onClick={() => {
              try {
                fork(project);
              } catch (error) {
                setNotice(editorErrorMessage(error));
              }
            }}
          >
            Duplicar proyecto
          </button>
        </div>
      </section>
      <p>
        La cuadrícula y las reglas compartidas pertenecen al motor. Podés editar todos los datos
        admitidos por el formato de campaña. La validación indica qué referencias o valores se deben
        corregir antes de exportar.
      </p>
    </>
  );
  return (
    <DocumentDraftProvider scope={project?.manifest.id ?? 'new'}>
      <main className="campaign-studio">
        <a className="studio-skip" href="#studio-panel">
          Ir al panel del editor
        </a>
        <header className="studio-header">
          <div>
            <p className="studio-kicker">GRANADEROS / HERRAMIENTAS DE AUTOR</p>
            <h1>Editor de campañas</h1>
          </div>
          <div className="studio-header-actions">
            <button
              type="button"
              aria-expanded={!project || managerOpen}
              aria-controls="studio-project-manager"
              disabled={Boolean(busy)}
              onClick={() => setManagerOpen(!managerOpen)}
            >
              <FolderOpen size={16} aria-hidden="true" />
              Administrar proyectos
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            <a href="../">
              <span>Volver al juego</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        </header>
        <fieldset
          id="studio-project-manager"
          className="studio-controls"
          hidden={Boolean(project) && !managerOpen}
          disabled={Boolean(busy) || !ready}
        >
          <legend>Proyectos</legend>
          <div className="studio-manager-grid">
            <section className="studio-manager-group">
              <h2>Crear una campaña</h2>
              <p>Empezá con un mundo y un personaje guía que podés cambiar.</p>
              <div className="studio-toolbar">
                <label>
                  Identidad
                  <input
                    value={createId}
                    onChange={(e) => setCreateId(e.target.value)}
                    pattern="[a-z][a-z0-9-]*"
                  />
                </label>
                <label>
                  Nombre
                  <input value={createName} onChange={(e) => setCreateName(e.target.value)} />
                </label>
                <button
                  className="editor-action-primary"
                  onClick={() =>
                    void run('Creando proyecto', async () => {
                      if (projects.some((p) => p.manifest.id === createId)) {
                        throw Error('Esta identidad ya tiene un borrador.');
                      }
                      open(await createCampaignProject(createId, createName));
                    })
                  }
                >
                  Crear campaña
                </button>
              </div>
              <p className="editor-help">
                La identidad usa letras minúsculas, números y guiones; debe comenzar con una letra.
              </p>
            </section>
            <section className="studio-manager-group">
              <h2>Abrir un proyecto</h2>
              <p>Continuá un borrador local o usá una campaña instalada como punto de partida.</p>
              <div className="studio-toolbar">
                <label>
                  Borrador guardado
                  <select
                    value={project?.manifest.id ?? ''}
                    onChange={(e) => {
                      const next = projects.find((p) => p.manifest.id === e.target.value);
                      if (next) {
                        void run('Abriendo borrador', async () => open(next));
                      }
                    }}
                  >
                    <option value="">Elegí un proyecto</option>
                    {projects.map((p) => (
                      <option key={p.manifest.id} value={p.manifest.id}>
                        {documentString(p.manifest['name'])} · {p.manifest.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Campaña instalada
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const entry = library.find((p) => p.id === e.target.value);
                      e.target.value = '';
                      if (entry) {
                        void run('Leyendo documentos y recursos', async () => {
                          await acceptImport(await loadInstalledCampaignProject(entry));
                        });
                      }
                    }}
                  >
                    <option value="">Abrir paquete instalado</option>
                    {library.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.revision}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
            <section className="studio-manager-group">
              <h2>Importar archivos</h2>
              <p>Abrí un proyecto portátil, una campaña ZIP o una carpeta completa.</p>
              <div className="studio-toolbar">
                <button onClick={() => fileRef.current?.click()}>Importar proyecto o ZIP</button>
                <button onClick={() => folderRef.current?.click()}>Importar carpeta</button>
              </div>
              <p className="editor-help">
                Los borradores con la misma identidad se importan como una copia.
              </p>
            </section>
          </div>
        </fieldset>
        <input
          hidden
          type="file"
          ref={fileRef}
          accept=".json,.zip,application/json,application/zip"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length) {
              void importFiles(files);
            }
          }}
        />
        <input
          hidden
          type="file"
          ref={(input) => {
            folderRef.current = input;
            input?.setAttribute('webkitdirectory', '');
          }}
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length) {
              void importFiles(files, true);
            }
          }}
        />
        {(busy || !ready) && <output>{busy || 'Cargando proyectos…'}</output>}
        {notice && <output className="studio-notice">{notice}</output>}
        {pendingImport && (
          <section className="studio-card">
            <h2>Importar con identidad nueva</h2>
            <p>El borrador existente se conserva.</p>
            <label>
              Identidad de copia
              <input value={forkId} onChange={(e) => setForkId(e.target.value)} />
            </label>
            <label>
              Nombre de copia
              <input value={forkName} onChange={(e) => setForkName(e.target.value)} />
            </label>
            <button
              onClick={() => {
                try {
                  fork(pendingImport);
                } catch (error) {
                  setNotice(editorErrorMessage(error));
                }
              }}
            >
              Importar como copia
            </button>
            <button onClick={() => setPendingImport(null)}>Cancelar importación</button>
          </section>
        )}
        {!project ? (
          <section className="studio-welcome">
            <h2>Comenzá una campaña</h2>
            <p>
              Creá un proyecto vacío con dos localidades y un personaje guía. También podés abrir un
              paquete instalado o importar una campaña completa.
            </p>
            <ol>
              <li>Definí el mundo y los mapas.</li>
              <li>Agregá personajes, equipo, diálogos y objetivos.</li>
              <li>Personalizá la presentación y los recursos.</li>
              <li>Probá el proyecto, corregí los informes y descargá el paquete.</li>
            </ol>
          </section>
        ) : (
          <>
            <div className="studio-project-bar">
              <div>
                <strong>{documentString(project.manifest['name'], 'Sin nombre')}</strong>
                <span>
                  {project.manifest.id} · revisión{' '}
                  {documentString(project.manifest['revision'], '—')}
                </span>
                <output
                  className="editor-status"
                  data-state={
                    saved.startsWith('Error')
                      ? 'error'
                      : saved === 'Guardado en este navegador'
                        ? 'saved'
                        : 'pending'
                  }
                >
                  {saved}
                </output>
              </div>
              <div className="studio-toolbar">
                <button
                  title="Deshacer (Ctrl/Cmd + Z)"
                  disabled={!history.past.length || Boolean(busy)}
                  onClick={undo}
                >
                  <Undo2 size={15} aria-hidden="true" />
                  Deshacer
                </button>
                <button
                  title="Rehacer (Ctrl/Cmd + Mayús + Z)"
                  disabled={!history.future.length || Boolean(busy)}
                  onClick={redo}
                >
                  <Redo2 size={15} aria-hidden="true" />
                  Rehacer
                </button>
                <button
                  disabled={Boolean(busy)}
                  onClick={() =>
                    download(
                      JSON.stringify(project, null, 2),
                      `${project.manifest.id}.project.json`,
                      'application/json',
                    )
                  }
                >
                  <Download size={15} aria-hidden="true" />
                  Descargar proyecto
                </button>
                <button
                  className="editor-action-primary"
                  aria-describedby="studio-export-guidance"
                  disabled={!valid || Boolean(busy)}
                  onClick={() =>
                    void run('Verificando y creando ZIP', async () => {
                      download(
                        await exportCampaignArchive(project),
                        `${project.manifest.id}-${documentString(project.manifest['revision'], '—')}.zip`,
                        'application/zip',
                      );
                      setNotice('Paquete verificado y descargado.');
                    })
                  }
                >
                  <PackageCheck size={16} aria-hidden="true" />
                  Descargar campaña ZIP
                </button>
                <button
                  className="studio-validation-status"
                  data-state={checking ? 'pending' : valid ? 'valid' : 'error'}
                  onClick={() => setSection('package')}
                >
                  {checking
                    ? 'Validando…'
                    : report?.valid
                      ? 'Paquete válido'
                      : `${report?.issues?.length ?? 0} problemas`}
                </button>
              </div>
            </div>
            <DocumentDraftStatus onOpen={() => setSection('documents')} />
            <div id="studio-export-guidance" className="studio-export-guidance">
              {checking ? (
                'Comprobando el proyecto antes de exportar…'
              ) : valid ? (
                'El paquete está listo para probar y descargar.'
              ) : (
                <>
                  <span>
                    El ZIP estará disponible cuando corrijas los problemas del proyecto. Podés
                    descargar el borrador ahora.
                  </span>
                  <button type="button" onClick={() => setSection('package')}>
                    Ver problemas
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
            <div className="studio-layout">
              <StudioNavigation
                section={section}
                onSelect={setSection}
                issues={report?.issues ?? []}
              />
              <fieldset disabled={Boolean(busy)} className="studio-panel" id="studio-panel">
                <legend className="sr-only">
                  {sections.find(([key]) => key === section)?.[1]}
                </legend>
                <div className="studio-panel-context">
                  <span>{String(documentString(project.manifest['name']) ?? 'Campaña')}</span>
                  <ChevronDown size={12} aria-hidden="true" />
                  <strong>{sections.find(([key]) => key === section)?.[1]}</strong>
                </div>
                <PanelBoundary
                  resetKey={project}
                  key={`${section}-${project.manifest.id}`}
                  onRecover={() => setSection('documents')}
                >
                  {section === 'project' ? (
                    projectPanel
                  ) : section === 'world' ? (
                    <WorldWorkspace {...{ project, onChange: change }} />
                  ) : section === 'maps' ? (
                    <MapWorkspace {...{ project, onChange: change }} />
                  ) : section === 'buildings' ? (
                    <BuildingWorkspace {...{ project, onChange: change }} />
                  ) : section === 'content' ? (
                    <ContentWorkspace {...{ project, onChange: change }} />
                  ) : section === 'presentation' ? (
                    <PresentationWorkspace {...{ project, onChange: change }} />
                  ) : section === 'assets' ? (
                    <AssetsWorkspace {...{ project, onChange: change }} />
                  ) : section === 'tests' ? (
                    <>
                      <h2>Pruebas del proyecto</h2>
                      <div className="studio-toolbar">
                        <button
                          aria-pressed={testTab === 'campaign'}
                          onClick={() => setTestTab('campaign')}
                        >
                          Campaña y encargos
                        </button>
                        <button
                          aria-pressed={testTab === 'weapons'}
                          onClick={() => setTestTab('weapons')}
                        >
                          Equipo y combate
                        </button>
                      </div>
                      {!valid ? (
                        <p role="alert">
                          Corregí la validación antes de iniciar una prueba.{' '}
                          <button onClick={() => setSection('package')}>Ver informe</button>
                        </p>
                      ) : (
                        compiled &&
                        (testTab === 'campaign' ? (
                          <QuestSandbox content={compiled} resolveAsset={resolveAsset} />
                        ) : (
                          <ContentEditor
                            embedded
                            initialTab="test"
                            content={compiled}
                            onContentChange={(next) => change(updateProjectContent(project, next))}
                            resolveAsset={resolveAsset}
                          />
                        ))
                      )}
                    </>
                  ) : section === 'package' ? (
                    <>
                      <h2>Validación y paquete</h2>
                      <p>
                        El estudio usa los validadores del motor y comprueba los bytes y las
                        referencias de los recursos. Los proyectos con problemas se pueden guardar
                        como borradores. El ZIP requiere un paquete válido.
                      </p>
                      <output>
                        {checking
                          ? 'Validando el proyecto…'
                          : report?.valid
                            ? 'El paquete es válido.'
                            : `${report?.issues?.length ?? 0} problemas requieren corrección.`}
                      </output>
                      {report?.checks && (
                        <dl className="studio-checks">
                          <dt>Mapas</dt>
                          <dd>{report.checks.maps}</dd>
                          <dt>Recursos</dt>
                          <dd>{report.checks.resources}</dd>
                          <dt>Bytes comprobados</dt>
                          <dd>{report.checks.resourceBytes.toLocaleString()}</dd>
                        </dl>
                      )}
                      <ul className="studio-issues">
                        {report?.issues?.map((issue, index: number) => (
                          <li key={index}>
                            <button onClick={() => setSection(issueSection(issue.section))}>
                              Revisar{' '}
                              {STUDIO_SECTIONS.find(
                                (item) => item.id === issueSection(issue.section),
                              )?.label ?? issue.section}
                            </button>
                            <span>{issue.message}</span>
                            {issue.path && <code>{issue.path}</code>}
                          </li>
                        ))}
                      </ul>
                      <h3>Instalar una campaña descargada</h3>
                      <p>
                        Descomprimí el ZIP y copiá su carpeta en <code>content/campaigns/</code> del
                        proyecto Granaderos. Iniciá el servidor o compilá y publicá el juego. La
                        preparación del juego descubre los manifiestos y publica los recursos. La
                        campaña conserva su identidad y revisión para las partidas guardadas.
                      </p>
                      <p>
                        Descargá el archivo de proyecto para seguir editando en otro navegador. El
                        ZIP contiene los archivos de juego; el proyecto también conserva las
                        plantillas de autor.
                      </p>
                      <a
                        href={pagePath('/') + '#studio-panel'}
                        onClick={() => setSection('project')}
                      >
                        Volver a los datos del proyecto
                      </a>
                    </>
                  ) : (
                    <>
                      <h2>Todos los documentos</h2>
                      <p>
                        Estos campos editan los mismos documentos que los otros paneles. Las
                        referencias se comprueban antes de exportar. El modo JSON es opcional.
                      </p>
                      {(
                        [
                          'manifest',
                          'content',
                          'world',
                          'presentation',
                          'maps',
                          'mapIndex',
                          'assets',
                          'editor',
                        ] as const
                      ).map((key) => (
                        <details key={key}>
                          <summary>{key}</summary>
                          <DocumentEditor
                            value={project[key] ?? {}}
                            path={key}
                            onChange={(value) =>
                              change(
                                assertCampaignProjectEnvelope({
                                  ...project,
                                  [key]: requireJsonDocument(value),
                                }),
                              )
                            }
                          />
                        </details>
                      ))}
                      <p>Los bytes de las imágenes y metadatos se administran en Recursos.</p>
                    </>
                  )}
                </PanelBoundary>
              </fieldset>
            </div>
          </>
        )}
        <footer className="studio-footer">
          <p>
            Ctrl/Cmd + Z: deshacer. Ctrl/Cmd + Mayús + Z: rehacer. Ctrl/Cmd + S: descargar proyecto.
          </p>
          {project && (
            <button
              className="studio-text-danger"
              disabled={Boolean(busy)}
              onClick={() => {
                if (
                  !window.confirm(
                    `Eliminar el borrador local ${project.manifest.id}? Descargá una copia antes de eliminarlo.`,
                  )
                ) {
                  return;
                }
                void run('Eliminando borrador', async () => {
                  await deleteStudioProject(project.manifest.id);
                  setProjects((current) =>
                    current.filter((p) => p.manifest.id !== project.manifest.id),
                  );
                  editingRepository.close();
                  currentRef.current = null;
                  setHistory(editingRepository.snapshot());
                  setSaved('');
                  try {
                    localStorage.removeItem(LAST_PROJECT);
                  } catch {}
                });
              }}
            >
              Eliminar este borrador local
            </button>
          )}
        </footer>
      </main>
    </DocumentDraftProvider>
  );
}
