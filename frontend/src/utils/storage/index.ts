// src/utils/storage/index.ts - Universal Web Storage (Zero Expo)

export const storage = {
  // Standard Storage
  get: async <T = any>(key: string, defaultValue: T | null = null): Promise<T | null> => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item);
    } catch {
      // If not JSON, return as plain string
      return (localStorage.getItem(key) as unknown as T) || defaultValue;
    }
  },

  set: async (key: string, value: any): Promise<void> => {
    if (typeof window === "undefined") return;
    try {
      const serialized = typeof value === "string" ? value : JSON.stringify(value);
      localStorage.setItem(key, serialized);
    } catch (e) {
      console.error(`Failed to set storage key "${key}":`, e);
    }
  },

  remove: async (key: string): Promise<void> => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`Failed to remove storage key "${key}":`, e);
    }
  },

  // Secure Storage Stubs (Web uses localStorage safely)
  secureGet: async <T = any>(key: string, defaultValue: T | null = null): Promise<T | null> => {
    return storage.get(key, defaultValue);
  },

  secureSet: async (key: string, value: any): Promise<void> => {
    return storage.set(key, value);
  },

  secureRemove: async (key: string): Promise<void> => {
    return storage.remove(key);
  },

  clear: async (): Promise<void> => {
    if (typeof window === "undefined") return;
    try {
      localStorage.clear();
    } catch (e) {
      console.error("Failed to clear storage:", e);
    }
  },
};

export default storage;
