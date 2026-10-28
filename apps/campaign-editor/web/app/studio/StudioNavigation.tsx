'use client';
import { useState } from 'react';
import {
  Folder,
  Globe,
  Map,
  Building2,
  Users,
  Palette,
  Image,
  FlaskConical,
  PackageCheck,
  FileCode2,
  Search,
  X,
} from 'lucide-react';

export const STUDIO_SECTIONS = [
  {
    id: 'project',
    label: 'Proyecto',
    group: 'Campaña',
    icon: Folder,
    description: 'Organizá tu campaña y elegí el próximo paso.',
  },
  {
    id: 'world',
    label: 'Mundo',
    group: 'Campaña',
    icon: Globe,
    description: 'Definí el terreno, las localidades y sus conexiones.',
  },
  {
    id: 'maps',
    label: 'Mapas tácticos',
    group: 'Campaña',
    icon: Map,
    description: 'Construí las escenas donde se juega tu campaña.',
  },
  {
    id: 'buildings',
    label: 'Edificios',
    group: 'Campaña',
    icon: Building2,
    description: 'Diseñá construcciones, guardá plantillas y revisá la vista 3D.',
  },
  {
    id: 'content',
    label: 'Historia y personajes',
    group: 'Campaña',
    icon: Users,
    description: 'Creá el elenco, el equipo, los diálogos y los objetivos.',
  },
  {
    id: 'presentation',
    label: 'Presentación',
    group: 'Identidad visual',
    icon: Palette,
    description: 'Personalizá el inicio, los retratos y la introducción.',
  },
  {
    id: 'assets',
    label: 'Recursos',
    group: 'Identidad visual',
    icon: Image,
    description: 'Administrá las imágenes que viajan con el proyecto.',
  },
  {
    id: 'tests',
    label: 'Pruebas',
    group: 'Revisión y entrega',
    icon: FlaskConical,
    description: 'Probá la campaña y el equipo con el motor del juego.',
  },
  {
    id: 'package',
    label: 'Validación y descarga',
    group: 'Revisión y entrega',
    icon: PackageCheck,
    description: 'Corregí los problemas y prepará una campaña instalable.',
  },
  {
    id: 'documents',
    label: 'Todos los documentos',
    group: 'Avanzado',
    icon: FileCode2,
    description: 'Editá cualquier campo del proyecto. El modo JSON es opcional.',
  },
] as const;
export type StudioSection = (typeof STUDIO_SECTIONS)[number]['id'];

type Props = {
  section: StudioSection;
  onSelect: (section: StudioSection) => void;
  issues?: { section: string }[];
};

export default function StudioNavigation({ section, onSelect, issues = [] }: Props) {
  const [query, setQuery] = useState('');
  const filtered = STUDIO_SECTIONS.filter((item) =>
    `${item.label} ${item.description}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  const groups = [...new Set(filtered.map((item) => item.group))];
  return (
    <nav className="studio-navigation" aria-label="Secciones del editor">
      <label className="studio-navigation-search">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Buscar herramienta</span>
        <input
          type="search"
          value={query}
          placeholder="Buscar herramienta"
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <button
            type="button"
            aria-label="Limpiar búsqueda de herramientas"
            onClick={() => setQuery('')}
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </label>
      {!filtered.length && <p className="studio-muted">No hay herramientas con ese nombre.</p>}
      {groups.map((group) => (
        <div className="studio-navigation-group" key={group}>
          <p>{group}</p>
          {filtered
            .filter((item) => item.group === group)
            .map((item) => {
              const count = issues.filter(
                (issue) =>
                  issue.section === item.id ||
                  (item.id === 'project' && issue.section === 'manifest'),
              ).length;
              return (
                <button
                  type="button"
                  key={item.id}
                  data-section={item.id}
                  data-issues={count || undefined}
                  aria-current={section === item.id ? 'page' : undefined}
                  aria-description={count ? `${count} problemas en esta sección` : undefined}
                  title={item.description}
                  onClick={() => onSelect(item.id)}
                >
                  <item.icon size={17} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
        </div>
      ))}
      <p className="studio-navigation-note">Guardado automático en este navegador.</p>
    </nav>
  );
}
