/**
 * Node 26 exposes an incomplete global localStorage unless it is started with
 * --localstorage-file. That property shadows jsdom's implementation and is
 * literally undefined, so install a small standards-compatible in-memory
 * storage for tests. Production code is unaffected by this setup file.
 */
class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() { return this.values.size; }

  clear() { this.values.clear(); }

  getItem(key: string) { return this.values.get(String(key)) ?? null; }

  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }

  removeItem(key: string) { this.values.delete(String(key)); }

  setItem(key: string, value: string) { this.values.set(String(key), String(value)); }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: storage,
});

if (typeof window !== "undefined" && window !== globalThis) {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
}
