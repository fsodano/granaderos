import type { SectorOrder } from '../../../domain/sector-sessions/sector-operation.ts';

export type ExecuteSectorOrderRequest = Readonly<{ order: SectorOrder }>;
