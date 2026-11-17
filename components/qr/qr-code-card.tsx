"use client";

import { OutClassQRCode } from "./outclass-qr-code";
import { QrPresenterDialog } from "./qr-presenter-dialog";
import { downloadQrPng, downloadQrSvg } from "@/lib/qr/export";
import { useShortLinkUrl } from "./use-short-link-url";

export { downloadQrPng, downloadQrSvg };

export { useShortLinkUrl };

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
