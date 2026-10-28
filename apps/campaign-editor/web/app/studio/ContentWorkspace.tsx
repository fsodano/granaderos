'use client';
import {
  projectContent,
  updateProjectContent,
} from '../../../infrastructure/project-operations.js';
import { useStudioAssetResolver } from '../../lib/campaign-studio-assets.ts';
import ContentEditor from '../story/ContentEditor.tsx';
import FieldEditor from './FieldEditor.tsx';

export default function ContentWorkspace({
  project,
  onChange,
}: {
  project: any;
  onChange: (next: any) => void;
}) {
  const resolveAsset = useStudioAssetResolver(project);
  return (
    <>
      <ContentEditor
        embedded
        content={projectContent(project)}
        onContentChange={(next) => onChange(updateProjectContent(project, next))}
        resolveAsset={resolveAsset}
      />
      <details>
        <summary>Todos los campos del contenido</summary>
        <p>
          Los cambios pertenecen al mismo proyecto. La validación del taller comprueba las
          identidades, los límites y las referencias antes de jugar o exportar.
        </p>
        <FieldEditor
          label="Contenido de campaña"
          path="content"
          value={project.content}
          onChange={(content) => onChange({ ...project, content })}
        />
      </details>
    </>
  );
}
