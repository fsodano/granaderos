export class DomainIdentityMap {
  readonly #objects = new Map<string, Map<string, object>>();

  obtain<T extends object>(kind: string, id: string, restore: () => T): T {
    let identities = this.#objects.get(kind);
    if (!identities) {
      identities = new Map();
      this.#objects.set(kind, identities);
    }
    const existing = identities.get(id);
    if (existing) return existing as T;
    const object = restore();
    identities.set(id, object);
    return object;
  }
}
