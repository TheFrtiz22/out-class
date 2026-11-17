"use client";

import { useEffect, useState } from "react";
import { OutClassQRCode } from "./outclass-qr-code";
import { QrPresenterDialog } from "./qr-presenter-dialog";
import { downloadQrPng, downloadQrSvg } from "@/lib/qr/export";
import { createShortLink } from "@/actions/short-links";

export { downloadQrPng, downloadQrSvg };

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
  const activeUrl = useShortLinkUrl(path);

  return (
    <OutClassQRCode
      value={activeUrl}
      size={184}
      variant="default"
      showLogo={true}
      downloadable={downloadable}
      title={title}
      description={description}
      filename={filename}
      ariaLabel={`QR code for ${title}`}
      actions={
        <QrPresenterDialog
          value={activeUrl}
          title={title}
          description={description}
          filename={filename}
          ariaLabel={`QR code for ${title}`}
        />
      }
    />
  );
}
