import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const webStorage: StorageAdapter = {
  getItem: (key) =>
    Promise.resolve(
      typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
    ),
  setItem: (key, value) =>
    Promise.resolve(
      typeof window !== 'undefined'
        ? window.localStorage.setItem(key, value)
        : undefined
    ),
  removeItem: (key) =>
    Promise.resolve(
      typeof window !== 'undefined'
        ? window.localStorage.removeItem(key)
        : undefined
    ),
};

// SecureStore has a ~2048 byte limit per key. Supabase session tokens
// (JWT access + refresh token) are usually bigger than that, so we
// split large values into numbered chunks and store each chunk under
// its own key: `${key}_0`, `${key}_1`, etc.
const CHUNK_SIZE = 2000;

const secureStorage: StorageAdapter = {
  getItem: async (key) => {
    const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunks`);
    if (!chunkCountStr) {
      // fallback: maybe it was stored unchunked (small value)
      return SecureStore.getItemAsync(key);
    }
    const chunkCount = parseInt(chunkCountStr, 10);
    const chunks: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
      if (chunk === null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },

  setItem: async (key, value) => {
    // clear any previous chunks first
    const oldChunkCountStr = await SecureStore.getItemAsync(`${key}_chunks`);
    if (oldChunkCountStr) {
      const oldChunkCount = parseInt(oldChunkCountStr, 10);
      for (let i = 0; i < oldChunkCount; i++) {
        await SecureStore.deleteItemAsync(`${key}_${i}`);
      }
    }
    await SecureStore.deleteItemAsync(key);

    if (value.length <= CHUNK_SIZE) {
      // small enough — store directly, no chunking needed
      await SecureStore.deleteItemAsync(`${key}_chunks`);
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < chunkCount; i++) {
      const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(`${key}_${i}`, chunk);
    }
    await SecureStore.setItemAsync(`${key}_chunks`, String(chunkCount));
  },

  removeItem: async (key) => {
    const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunks`);
    if (chunkCountStr) {
      const chunkCount = parseInt(chunkCountStr, 10);
      for (let i = 0; i < chunkCount; i++) {
        await SecureStore.deleteItemAsync(`${key}_${i}`);
      }
      await SecureStore.deleteItemAsync(`${key}_chunks`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? webStorage : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});