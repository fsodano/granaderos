import { CampaignProject } from '../domain/campaign-project.ts';

export function projectContent(document) {
  return new CampaignProject(document).previewContent();
}

export function updateProjectContent(document, content) {
  const project = new CampaignProject(document);
  project.replaceContent(content);
  return project.snapshot();
}

export function renameCampaignProject(document, identifier, name) {
  const project = new CampaignProject(document);
  project.rename(identifier, name);
  return project.snapshot();
}

export async function setProjectResource(document, path, bytes, type, identifier) {
  const project = new CampaignProject(document);
  await project.replaceResource(path, bytes, type, identifier);
  return project.snapshot();
}

export function removeProjectResource(document, path) {
  const project = new CampaignProject(document);
  project.removeResource(path);
  return project.snapshot();
}
