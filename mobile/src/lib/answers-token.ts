import * as Crypto from "expo-crypto";

/**
 * The save contract's compare token (`expectedAnswers`) as sent to the server: `sha256:` and the
 * SHA-256 of the saved answers' key (actions/applications.ts `answersKeyMatches`). The key itself
 * repeats every saved answer, which made a long draft's request too large to send.
 */
export async function answersToken(key: string): Promise<string> {
  try {
    return `sha256:${(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key, { encoding: Crypto.CryptoEncoding.HEX })).toLowerCase()}`;
  } catch {
    // Without a digest the server still accepts the key itself.
    return key;
  }
}
