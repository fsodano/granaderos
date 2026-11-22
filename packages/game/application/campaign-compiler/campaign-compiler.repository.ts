import type {
  CampaignDefinition,
  CampaignDefinitionDocuments,
  ImmutableDefinition,
} from '../../../campaign-format/campaign-definition.ts';
import type { CampaignManifest } from '../../../campaign-format/types.ts';
import type { CampaignCompilerRequest } from './campaign-compiler.request.ts';
import type { CampaignCompilerResponse } from './campaign-compiler.response.ts';

export type CampaignCompilationContext = {
  readonly definition: CampaignDefinition;
  readonly manifest: ImmutableDefinition<CampaignManifest>;
  readonly documents: ImmutableDefinition<CampaignDefinitionDocuments>;
  compiled: CampaignCompilerResponse | null;
};

export interface CampaignCompilerRepository {
  load(request: CampaignCompilerRequest): CampaignCompilationContext;
  commit(context: CampaignCompilationContext, outcome: CampaignCompilerResponse): void;
}
