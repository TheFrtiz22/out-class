"use client";

import { useEffect, useState } from "react";
import { createShortLink } from "@/actions/short-links";

/**
 * The URL a QR code should carry for an in-app path: the first-party OutClass short link when the server issues one
 * (server-validated and session-bound), otherwise the direct URL (signed out, Demo, or a path that is not shareable).
 */
export function useShortLinkUrl(path: string) {
  const [origin, setOrigin] = useState("");
  const [optimizedUrl, setOptimizedUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const orig = window.location.origin;
    let current = true;
    setOrigin(orig);
    setOptimizedUrl("");
    createShortLink({ target: path })
      .then((res) => {
        if (current) setOptimizedUrl(`${orig}${res.shortUrl}`);
      })
      .catch(() => {
        // Graceful fallback to direct URL on local/offline environments
        if (current) setOptimizedUrl(`${orig}${path}`);
      });
    return () => { current = false; };
  }, [path]);

  return optimizedUrl || (origin ? `${origin}${path}` : "");
}
