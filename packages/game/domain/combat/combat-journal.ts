// This is an event-time public record, not a projection of the legacy log.
// Callers must admit the observation before writing names or outcomes. Never
// reconstruct earlier entries from log strings or from later visibility.

// One public line stays readable; a turn bound keeps an entry from naming a
// moment the record has not reached.
const ENTRY_TEXT_LIMIT = 1000;

export type CombatJournalEntry = Readonly<{ turn: number; text: string }>;

export type CombatJournal = Readonly<{
  version: 1;
  entries: readonly CombatJournalEntry[];
}>;

// Persisted journal data is untrusted: the rules below are what certify it.
export type CombatJournalState = {
  turn: number;
  publicJournal?: unknown;
};

export const COMBAT_JOURNAL_LIMIT = 80;

const validEntry = (entry: unknown, turn: number): entry is CombatJournalEntry => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return false;
  }
  if (!Object.keys(entry).every((key) => key === 'turn' || key === 'text')) {
    return false;
  }
  const { turn: entryTurn, text } = entry as { turn?: unknown; text?: unknown };
  return (
    typeof entryTurn === 'number' &&
    Number.isInteger(entryTurn) &&
    entryTurn >= 1 &&
    entryTurn <= turn &&
    typeof text === 'string' &&
    text.length > 0 &&
    text.length <= ENTRY_TEXT_LIMIT
  );
};

export function validCombatJournal(
  journal: unknown,
  turn: number,
): journal is CombatJournal | undefined {
  if (journal === undefined) {
    return true;
  }
  if (!journal || typeof journal !== 'object' || Array.isArray(journal)) {
    return false;
  }
  if (!Object.keys(journal).every((key) => key === 'version' || key === 'entries')) {
    return false;
  }
  const { version, entries } = journal as { version?: unknown; entries?: unknown };
  return (
    version === 1 &&
    Array.isArray(entries) &&
    entries.length <= COMBAT_JOURNAL_LIMIT &&
    entries.every((entry) => validEntry(entry, turn))
  );
}

/** Copy certified stored entries without rewriting historical presentation. */
export function storedCombatJournal(state: CombatJournalState): CombatJournalEntry[] {
  const journal = state.publicJournal;
  return journal && validCombatJournal(journal, state.turn)
    ? journal.entries.map(({ turn, text }) => ({ turn, text }))
    : [];
}

/** Read the same certified entries for the visible journal and WebMCP. */
export function publicCombatJournal(state: CombatJournalState): CombatJournalEntry[] {
  // Older partial wound steps recorded a loss even when no full tick elapsed.
  // Hide only that false report; stored entries remain intact for later writes.
  return storedCombatJournal(state).filter(
    (entry) => !/^.+ pierde 0 de salud por hemorragia\.$/.test(entry.text),
  );
}

/** Mutates presentation metadata only; the admission belongs to the caller. */
export function recordPublicCombatMessage(state: CombatJournalState, text: string): void {
  const entries = storedCombatJournal(state);
  const entry = { turn: state.turn, text };
  if (!validEntry(entry, state.turn)) {
    return;
  }
  state.publicJournal = { version: 1, entries: [...entries, entry].slice(-COMBAT_JOURNAL_LIMIT) };
}
