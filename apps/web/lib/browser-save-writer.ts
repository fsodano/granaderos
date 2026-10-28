export const SaveWriterMessages = Object.freeze({
  unavailable:
    'Este navegador no permite coordinar el guardado entre pestañas. Podés seguir jugando y descargar la partida con Guardar.',
  occupied:
    'Otra pestaña guarda esta campaña. Podés seguir jugando y descargar la partida con Guardar. Cerrá la otra pestaña para recuperar el guardado automático.',
});

type LockManagerPort = Pick<LockManager, 'request'>;

export class BrowserSaveWriter {
  readonly #locks: LockManagerPort | undefined;
  readonly #write: (key: string, text: string) => void;
  #key: string | null = null;
  #ownedKey: string | null = null;
  #release: (() => void) | null = null;
  #generation = 0;
  #closed = false;

  constructor(
    locks: LockManagerPort | undefined,
    write: (key: string, text: string) => void,
  ) {
    this.#locks = locks;
    this.#write = write;
  }

  claim(
    key: string,
    onReady: () => void,
    onRefused: (message: string) => void,
  ): void {
    if (this.#closed) return;
    if (this.#ownedKey === key) {
      onReady();
      return;
    }
    if (this.#key === key) return;
    this.#release?.();
    this.#release = null;
    this.#ownedKey = null;
    this.#key = key;
    const generation = ++this.#generation;
    if (!this.#locks) {
      this.#key = null;
      onRefused(SaveWriterMessages.unavailable);
      return;
    }
    void this.#locks
      .request(
        `granaderos-save:${key}`,
        { mode: 'exclusive', ifAvailable: true },
        async (lock) => {
          if (this.#closed || generation !== this.#generation) return;
          if (!lock) {
            this.#key = null;
            onRefused(SaveWriterMessages.occupied);
            return;
          }
          this.#ownedKey = key;
          const held = new Promise<void>((release) => {
            this.#release = release;
          });
          onReady();
          await held;
          if (generation === this.#generation) {
            this.#ownedKey = null;
            this.#key = null;
          }
        },
      )
      .catch((error) => {
        if (this.#closed || generation !== this.#generation) return;
        this.#key = null;
        onRefused(
          error instanceof Error
            ? error.message
            : SaveWriterMessages.unavailable,
        );
      });
  }

  owns(key: string): boolean {
    return !this.#closed && this.#ownedKey === key;
  }

  write(key: string, text: string): void {
    if (!this.owns(key)) throw new Error(SaveWriterMessages.occupied);
    this.#write(key, text);
  }

  close(): void {
    this.#closed = true;
    this.#generation++;
    this.#release?.();
    this.#release = null;
    this.#ownedKey = null;
    this.#key = null;
  }
}
