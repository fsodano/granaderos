export interface RestoreGameRepository<TGame> {
  read(): string;
  restore(text: string): TGame;
}
