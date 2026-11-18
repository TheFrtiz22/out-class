import * as SecureStore from "expo-secure-store";

/**
 * Supabase session storage in the Keychain / Keystore. A session is larger than SecureStore's
 * per-item size guidance (2048 bytes), so values are split into numbered chunks.
 */
const CHUNK = 1800;
const countKey = (key: string) => `${key}.n`;
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");

export const secureStorage = {
  async getItem(rawKey: string): Promise<string | null> {
    const key = safe(rawKey);
    const count = Number(await SecureStore.getItemAsync(countKey(key)));
    if (!Number.isInteger(count) || count < 1) return null;
    const parts = await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${key}.${index}`)));
    return parts.some(part => part === null) ? null : parts.join("");
  },
  async setItem(rawKey: string, value: string): Promise<void> {
    const key = safe(rawKey);
    const previous = Number(await SecureStore.getItemAsync(countKey(key))) || 0;
    const count = Math.max(1, Math.ceil(value.length / CHUNK));
    for (let index = 0; index < count; index++) await SecureStore.setItemAsync(`${key}.${index}`, value.slice(index * CHUNK, (index + 1) * CHUNK));
    await SecureStore.setItemAsync(countKey(key), String(count));
    for (let index = count; index < previous; index++) await SecureStore.deleteItemAsync(`${key}.${index}`);
  },
  async removeItem(rawKey: string): Promise<void> {
    const key = safe(rawKey);
    const count = Number(await SecureStore.getItemAsync(countKey(key))) || 0;
    for (let index = 0; index < count; index++) await SecureStore.deleteItemAsync(`${key}.${index}`);
    await SecureStore.deleteItemAsync(countKey(key));
  },
};
