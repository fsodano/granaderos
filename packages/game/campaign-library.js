import { CampaignDefinition } from '../campaign-format/campaign-definition.ts';

export {
  validateCampaignManifest,
  validateCampaignRegistry,
} from '../campaign-format/campaign-manifest.js';
export { campaignRelativePath } from './campaign-assets.js';

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const need = (ok, message) => {
  if (!ok) {
    throw Error(message);
  }
};

/**
 * Read the shared campaign-file contract into the context the compiler consumes.
 * Admission belongs to the shared contract; the compiler owns the runtime rules.
 */
export class CampaignLibraryCompilerRepository {
  /**
   * @param {import('./application/campaign-compiler/campaign-compiler.request.ts').CampaignCompilerRequest} request
   * @returns {import('./application/campaign-compiler/campaign-compiler.repository.ts').CampaignCompilationContext}
   */
  load({ manifest, documents }) {
    need(object(documents), 'La campaña necesita documentos válidos.');
    const definition = new CampaignDefinition(manifest, documents);
    return {
      definition,
      manifest: definition.manifest,
      documents: definition.documents,
      compiled: null,
    };
  }

  /**
   * @param {import('./application/campaign-compiler/campaign-compiler.repository.ts').CampaignCompilationContext} context
   * @param {import('./application/campaign-compiler/campaign-compiler.response.ts').CampaignCompilerResponse} outcome
   */
  commit(context, outcome) {
    context.compiled = outcome;
  }
}
