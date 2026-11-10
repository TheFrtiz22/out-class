"use client";

import { useEffect, useState } from "react";
import { OutClassQRCode } from "./outclass-qr-code";
import { downloadQrPng, downloadQrSvg } from "@/lib/qr/export";
import { createShortLink } from "@/actions/short-links";

export { downloadQrPng, downloadQrSvg };

export interface QrCodeCardProps {
  title: string;
  description: string;
  path: string;
  filename: string;
  downloadable?: boolean;
}

export function QrCodeCard({
  title,
  description,
  path,
  filename,
  downloadable = true,
}: QrCodeCardProps) {
  const [origin, setOrigin] = useState("");
  const [optimizedUrl, setOptimizedUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const orig = window.location.origin;
      setOrigin(orig);

      // Attempt to optimize with an OutClass short link for clean, low-density QR
      // Server-validated and session-bound; falls back to the direct URL when
      // signed out (e.g. demo) or when the path is not a shareable destination.
      createShortLink({ target: path })
        .then((res) => {
          setOptimizedUrl(`${orig}${res.shortUrl}`);
        })
        .catch(() => {
          // Graceful fallback to direct URL on local/offline environments
          setOptimizedUrl(`${orig}${path}`);
        });
    }
  }, [path]);

  const activeUrl = optimizedUrl || (origin ? `${origin}${path}` : "");

  return (
    <OutClassQRCode
      value={activeUrl}
      size={184}
      variant="default"
      showLogo={true}
      downloadable={downloadable}
      presenterMode={true}
      title={title}
      description={description}
      filename={filename}
      ariaLabel={`QR code for ${title}`}
    />
  );
}
