export class SectorGetVisibleCharactersRepository {
  #characters;
  #canObserve;

  constructor(characters, canObserve) {
    this.#characters = characters;
    this.#canObserve = canObserve;
  }

  *inspect() {
    for (const character of this.#characters) {
      yield { characterId: String(character.id), visible: this.#canObserve(character) };
    }
  }
}
