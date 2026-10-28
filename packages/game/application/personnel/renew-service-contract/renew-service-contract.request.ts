export type RenewServiceContractRequest = Readonly<{
  characterId: string;
  term: string;
  expectedExpiresAtSeconds?: number | null;
  expectedGuaranteeId?: string;
}>;
