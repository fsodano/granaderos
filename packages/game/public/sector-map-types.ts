import type {
  CampaignContent,
  MapUpperSurface,
  MapClimbLink,
  MapObject,
} from '../../campaign-format/types.ts';
import type { CampaignOperative, CampaignPendingBattle } from './campaign-types.ts';
import type {
  BattleSnapshot,
  BattleUnit,
  BattleArtillery,
  TacticalPoint,
} from './compatibility-types.ts';

export type SectorMapRequest = Partial<Omit<CampaignPendingBattle, 'squad' | 'enemies'>> & {
  squad?: CampaignOperative[];
  campaignPackage?: CampaignContent;
  compactLayout?: boolean;
  difficulty?: number;
  cannons?: number;
  enemies?: Partial<BattleUnit>[];
  artillery?: Partial<BattleArtillery>[];
  upperSurfaces?: MapUpperSurface[];
  climbLinks?: MapClimbLink[];
  roadsideDiscoveryDefinitions?: CampaignContent['roadsideDiscoveries'];
};
export type SectorMap = Omit<
  SectorMapRequest,
  'campaignPackage' | 'squad' | 'enemies' | 'artillery'
> &
  Pick<
    BattleSnapshot,
    'width' | 'height' | 'tiles' | 'buildings' | 'props' | 'lights' | 'groundItems'
  > & {
    sourceMapId: string;
    sourceMapRevision: number;
    sector: string;
    name: string | undefined;
    mapTitle: string | undefined;
    wallEdges: NonNullable<BattleSnapshot['wallEdges']>;
    wallGeometryVersion: 2;
    decor: MapObject[];
    worldCell?: boolean;
    squad: (CampaignOperative & TacticalPoint)[];
    enemies: (Partial<BattleUnit> & {
      id: string;
      name: string;
      weapon: BattleUnit['weapon'];
      marksmanship: number;
      morale: number;
    })[];
    artillery: (Partial<BattleArtillery> & TacticalPoint)[];
  };
