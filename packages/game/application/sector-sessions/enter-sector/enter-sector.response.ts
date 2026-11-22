export type EnterSectorResponse<Snapshot> = Readonly<{
  snapshot: Snapshot;
  sessionId: string;
  resumed: boolean;
}>;
