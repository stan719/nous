import { del, get, set } from 'idb-keyval'
import type { StateStorage } from 'zustand/middleware'

/** Magazyn dla `persist` oparty na IndexedDB (większy limit niż localStorage, działa offline). */
export const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: (name, value) => set(name, value),
  removeItem: (name) => del(name),
}
