import * as SecureStore from "expo-secure-store";

/**
 * Supabase session storage in the Keychain / Keystore. A session is larger than SecureStore's
 * per-item size guidance (2048 bytes), so values are split into numbered chunks. The guidance is
 * in bytes, so text with non-ASCII characters (a name in the user metadata) gets smaller chunks.
 */
const CHUNK = 1800;
const NARROW_CHUNK = 600;
const MAX_CHUNKS = 64;
const countKey = (key: string) => `${key}.n`;
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");
const storedCount = async (key: string) => {
  const count = Number(await SecureStore.getItemAsync(countKey(key)));
  return Number.isInteger(count) && count > 0 && count <= MAX_CHUNKS ? count : 0;
};

/**
 * `value` in pieces of at most `size` UTF-16 units. A piece never ends on the first half of a surrogate
 * pair (an emoji): the Keychain stores UTF-8, where half a pair becomes U+FFFD and the value no longer
 * reads back as written, so such a piece ends one unit earlier.
 */
function split(value: string, size: number): string[] {
  const pieces: string[] = [];
  for (let start = 0; start < value.length;) {
    let end = Math.min(start + size, value.length);
    const last = value.charCodeAt(end - 1);
    if (end < value.length && last >= 0xd800 && last <= 0xdbff) end--;
    pieces.push(value.slice(start, end));
    start = end;
  }
  return pieces.length ? pieces : [""];
}

async function remove(key: string, count: number) {
  for (let index = 0; index < count; index++) await SecureStore.deleteItemAsync(`${key}.${index}`).catch(() => {});
  await SecureStore.deleteItemAsync(countKey(key)).catch(() => {});
}

export const secureStorage = {
  async getItem(rawKey: string): Promise<string | null> {
    const key = safe(rawKey);
    try {
      const count = await storedCount(key);
      if (!count) return null;
      const parts = await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${key}.${index}`)));
      return parts.some(part => part === null) ? null : parts.join("");
    } catch {
      // A Keystore entry that cannot be decrypted (restored from a backup, key invalidated) reads as
      // no session, so the person is asked to sign in instead of the launch hanging; signing in
      // overwrites it. Nothing is deleted here, so a passing failure never loses a good session.
      return null;
    }
  },
  async setItem(rawKey: string, value: string): Promise<void> {
    const key = safe(rawKey);
    const previous = await storedCount(key).catch(() => 0);
    const pieces = split(value, /^[\x00-\x7f]*$/.test(value) ? CHUNK : NARROW_CHUNK);
    const count = pieces.length;
    for (let index = 0; index < count; index++) await SecureStore.setItemAsync(`${key}.${index}`, pieces[index]);
    await SecureStore.setItemAsync(countKey(key), String(count));
    for (let index = count; index < previous; index++) await SecureStore.deleteItemAsync(`${key}.${index}`).catch(() => {});
  },
  async removeItem(rawKey: string): Promise<void> {
    const key = safe(rawKey);
    await remove(key, await storedCount(key).catch(() => 0));
  },
};
