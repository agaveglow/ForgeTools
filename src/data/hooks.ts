import { useSyncExternalStore } from 'react';
import { createStore } from './store';
import { LocalStorageAdapter } from './storage';
import { VaultAdapter } from './vault';
import { setFileCipher } from './files';
import type { Store } from './store';
import type { CollectionMap, CollectionName, Settings } from './types';

/** Single app-wide store. Tests create their own with a MemoryAdapter. */
export const vault = new VaultAdapter(new LocalStorageAdapter('local'));
export const store: Store = createStore(vault);

setFileCipher({ state: () => vault.state, encrypt: (t) => vault.encryptFileText(t), decrypt: (t) => vault.decryptFileText(t) });

export function useVault(): VaultAdapter {
  useSyncExternalStore(vault.subscribe, vault.getVersion);
  return vault;
}

export function useStoreVersion(): number {
  return useSyncExternalStore(store.subscribe, store.getVersion);
}

/** Subscribe to a collection. The returned array identity is stable until that collection changes. */
export function useCollection<K extends CollectionName>(name: K): CollectionMap[K][] {
  return useSyncExternalStore(store.subscribe, () => store.list(name));
}

export function useRecord<K extends CollectionName>(name: K, id: string | undefined): CollectionMap[K] | undefined {
  const list = useCollection(name);
  return id ? (list.find((r) => r.id === id) as CollectionMap[K] | undefined) : undefined;
}

export function useSettings(): Settings {
  return useSyncExternalStore(store.subscribe, () => store.getSettings());
}
