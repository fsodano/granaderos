export type OfficerChoice = { id: string; name: string };
export type OfficerQuestion = { id: string; label: string; choices: OfficerChoice[] };
export type OfficerClass = {
  id: string;
  name: string;
  description: string;
  weapon: string | null;
  blade: string | null;
  bladeFittingPattern?: string;
};
export type OfficerCommission = {
  role: string;
  biography: string;
  questionError: string;
  statusText: string;
  availableText: string;
  weapon: string | null;
  doctrineWeapons: Record<string, string | null>;
};
export type OfficerCreation = {
  classes: OfficerClass[];
  questions: OfficerQuestion[];
  commissionQuestions: OfficerQuestion[];
  traits: { id: string; name: string; description: string }[];
  defaults: { classId: string; portraitId: string | null };
  commission: OfficerCommission;
  registry: string;
  biography: string;
};
export type OfficerCreationDefinition = Partial<
  Omit<OfficerCreation, 'defaults' | 'commission'>
> & { defaults?: Partial<OfficerCreation['defaults']>; commission?: Partial<OfficerCommission> };
