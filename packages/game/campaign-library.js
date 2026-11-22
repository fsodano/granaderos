import { CampaignDefinition } from '../campaign-format/campaign-definition.ts';
import { CampaignCompiler } from './application/campaign-compiler/campaign-compiler.use-case.ts';

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

/**
 * Retained compatibility adapter. New callers use `CampaignCompiler` through the
 * declared public entry; this name stays for the build tools that still read it.
 * @param {unknown} manifest
 * @param {unknown} documents
 * @returns {import('../campaign-format/types.ts').CompiledCampaignContent}
 */
export function compileCampaignPackage(manifest, documents) {
  const repository = new CampaignLibraryCompilerRepository();
  return new CampaignCompiler(repository).execute({ manifest, documents });
}
