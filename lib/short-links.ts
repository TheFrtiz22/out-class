/**
 * Short-link architecture and URL optimization for OutClass.
 *
 * Provides compact, cryptographically random, collision-resistant identifiers
 * that resolve to internal meetings, events, club profiles, and voting sessions.
 * Prevents open redirects and protects attendance security.
 */

import { randomBytes, createHash } from "node:crypto";
import { ALLOWED_SHORTLINK_DOMAINS } from "@/lib/qr/constants";

export interface ShortLinkRecord {
  code: string;
  target: string;
  type: "meeting-check-in" | "event" | "club" | "vote" | "generic";
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
  revokedAt: string | null;
  revocationReason: string | null;
  clubId?: string | null;
  eventId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ResolveResult {
  status: "valid" | "expired" | "revoked" | "not-found" | "invalid-target";
  record?: ShortLinkRecord;
  target?: string;
  message?: string;
}

const BASE62_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Generate a cryptographically random, URL-safe base62 identifier.
 * 6 characters provide 62^6 ≈ 56.8 billion combinations.
 */
export function generateRandomShortCode(length: number = 6): string {
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += BASE62_ALPHABET[bytes[i] % 62];
  }
  return result;
}

/**
 * Validates that a short-link target is a safe internal relative path
 * or an explicitly allowed OutClass domain. Prevents open redirect attacks.
 */
export function isValidRedirectTarget(target: string): boolean {
  if (!target || typeof target !== "string") return false;
  const trimmed = target.trim();

  // Reject protocol-relative, backslash tricks, or control characters
  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("\r") ||
    trimmed.includes("\n") ||
    trimmed.includes("\0")
  ) {
    return false;
  }

  // Safe internal relative path
  if (trimmed.startsWith("/")) {
    // Disallow javascript: or data: pseudo-protocols encoded in paths
    if (/^\/[a-z0-9_-]+:/i.test(trimmed)) {
      return false;
    }
    return true;
  }

  // Absolute URL validation against allowed domain list
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }
    const hostname = url.hostname.toLowerCase();
    const isAllowed = ALLOWED_SHORTLINK_DOMAINS.some((allowed) => {
      if (allowed.startsWith("*.")) {
        const root = allowed.slice(2);
        return hostname === root || hostname.endsWith(`.${root}`);
      }
      return hostname === allowed;
    });
    return isAllowed;
  } catch {
    return false;
  }
}

/**
 * Generates the deterministic target hash used to deduplicate permanent short links.
 */
export function getTargetHash(target: string): string {
  return createHash("sha256").update(target.trim()).digest("hex");
}
