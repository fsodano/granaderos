'use client';
import type { CampaignProjectDocument } from '../../../domain/campaign-project.ts';
import { assertCampaignContent, requireJsonDocument } from '../../lib/editor-documents.ts';
import { editorErrorMessage } from '../../../infrastructure/editor-error-message.ts';
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
  project: CampaignProjectDocument;
  onChange: (next: CampaignProjectDocument) => void;
}) {
  const resolveAsset = useStudioAssetResolver(project);
  const content = projectContent(project);
  let contentError = '';
  let validContent = null;
  try {
    assertCampaignContent(content);
    validContent = content;
  } catch (error) {
    contentError = editorErrorMessage(error);
  }
  return (
    <>
      {validContent ? (
        <ContentEditor
          embedded
          content={validContent}
          onContentChange={(next) => onChange(updateProjectContent(project, next))}
          resolveAsset={resolveAsset}
        />
      ) : (
        <p role="alert">Corregí los campos del contenido para abrir las fichas: {contentError}</p>
      )}
      <details open={!validContent}>
        <summary>Todos los campos del contenido</summary>
        <p>
          Los cambios pertenecen al mismo proyecto. La validación del taller comprueba las
          identidades, los límites y las referencias antes de jugar o exportar.
        </p>
        <FieldEditor
          label="Contenido de campaña"
          path="content"
          value={project.content}
          onChange={(content) => onChange({ ...project, content: requireJsonDocument(content) })}
        />
      </details>
    </>
  );
}
