import { CampaignCompiler } from '../application/campaign-compiler/campaign-compiler.use-case.ts';
import { CampaignLibraryCompilerRepository } from '../campaign-library.js';

export { CampaignCompiler } from '../application/campaign-compiler/campaign-compiler.use-case.ts';
export type { CampaignCompilerRequest } from '../application/campaign-compiler/campaign-compiler.request.ts';
export type { CampaignCompilerResponse } from '../application/campaign-compiler/campaign-compiler.response.ts';
export type {
  CampaignCompilationContext,
  CampaignCompilerRepository,
} from '../application/campaign-compiler/campaign-compiler.repository.ts';

/** Compose the compiler with the adapter that reads the shared campaign-file contract. */
export function createCampaignCompiler(): CampaignCompiler {
  return new CampaignCompiler(new CampaignLibraryCompilerRepository());
}
