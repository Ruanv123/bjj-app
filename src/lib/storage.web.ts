/**
 * Na web usamos o localStorage do navegador (evita carregar o SQLite/wasm).
 * Durante a renderização no servidor ele não existe: usamos um storage em memória.
 */
const memory = new Map<string, string>();

const memoryStorage: Storage = {
  get length() {
    return memory.size;
  },
  clear: () => memory.clear(),
  getItem: (key) => memory.get(key) ?? null,
  key: (index) => Array.from(memory.keys())[index] ?? null,
  removeItem: (key) => void memory.delete(key),
  setItem: (key, value) => void memory.set(key, value),
};

export const storage: Storage =
  typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : memoryStorage;
