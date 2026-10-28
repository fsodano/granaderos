export type TalkToCharacterRequest = Readonly<{
  characterId: string;
  speakerId: string;
  approach: string;
  expectedRevision?: number;
  serviceTerm?: string;
  dialogueNodeId?: string;
  dialogueChoiceId?: string;
  questResolution?: 'cash' | 'recruit';
  questWithdrawal?: { questId: string; beneficiaryId?: string; deliveredCount: number };
}>;
