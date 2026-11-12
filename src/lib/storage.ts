import 'expo-sqlite/localStorage/install';

/** localStorage persistente (SQLite) no iOS/Android. */
export const storage: Storage = globalThis.localStorage;
