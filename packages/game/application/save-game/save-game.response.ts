export type GameSaveIdentity = Readonly<{
  sessionId: string;
  revision: number;
  requestId: string;
}>;
