import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// In-memory fallback for web or when SecureStore is not accessible
const memoryStorage = new Map<string, string>();

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS !== "web") {
      await SecureStore.setItemAsync(key, value);
    } else {
      memoryStorage.set(key, value);
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    }
  } catch {
    memoryStorage.set(key, value);
  }
}

export async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS !== "web") {
      return await SecureStore.getItemAsync(key);
    } else {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return memoryStorage.get(key) || null;
    }
  } catch {
    return memoryStorage.get(key) || null;
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    if (Platform.OS !== "web") {
      await SecureStore.deleteItemAsync(key);
    } else {
      memoryStorage.delete(key);
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    memoryStorage.delete(key);
  }
}

// Offline Cache Metadata
export interface CachedData<T> {
  data: T;
  cachedAt: string;
}

export async function saveToOfflineCache<T>(key: string, data: T): Promise<void> {
  const payload: CachedData<T> = {
    data,
    cachedAt: new Date().toISOString(),
  };
  await setItem(`cache_${key}`, JSON.stringify(payload));
}

export async function loadFromOfflineCache<T>(key: string): Promise<CachedData<T> | null> {
  const raw = await getItem(`cache_${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedData<T>;
  } catch {
    return null;
  }
}
