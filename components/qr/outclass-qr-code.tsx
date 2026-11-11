"use client";
import { userMessage } from "@/lib/user-message"

import { useMemo, useRef, useState, type ReactNode } from "react";
import { Download, Copy, Check } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { generateOutClassQRSVG, type QRCodeRenderOptions } from "@/lib/qr/renderer";
import { downloadQrPng, downloadQrSvg } from "@/lib/qr/export";
import { BRAND_NAVY, BRAND_IVORY } from "@/lib/qr/constants";

export interface OutClassQRCodeProps {
  /** The exact URL or text payload encoded into the QR matrix */
  value: string;
  /** Rendered display size in pixels (default 320) */
  size?: number;
  /** UI presentation variant: default (card), compact (QR only), print (flyer mode) */
  variant?: "default" | "compact" | "print";
  /** Whether to render the official OutClass OC monogram center badge (default true) */
  showLogo?: boolean;
  /** Whether to display PNG and SVG download actions (default false) */
  downloadable?: boolean;
  /**
   * Extra controls rendered in the default card's action row. Projector display
   * goes through `QrPresenterDialog` (@/components/qr/qr-presenter-dialog).
   */
  actions?: ReactNode;
  /** Optional title displayed above or alongside the QR code */
  title?: string;
  /** Optional descriptive subtitle */
  description?: string;
  /** Base filename for downloaded assets (without extension) */
  filename?: string;
  /** Accessible label describing the QR code purpose */
  ariaLabel?: string;
  /** Additional CSS class names applied to the container */
  className?: string;
  /** Foreground module color (defaults to OutClass Navy) */
  fgColor?: string;
  /** Background surface color (defaults to White / Warm Ivory) */
  bgColor?: string;
}

export function OutClassQRCode({
  value,
  size = 320,
  variant = "default",
  showLogo = true,
  downloadable = false,
  actions,
  title,
  description,
  filename = "outclass-qr",
  ariaLabel,
  className = "",
  fgColor = BRAND_NAVY,
  bgColor = BRAND_IVORY,
}: OutClassQRCodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [message, setMessage] = useState("");

  const qrOptions: QRCodeRenderOptions = useMemo(
    () => ({
      fgColor,
      bgColor,
      showLogo,
      title: title || ariaLabel,
      ariaLabel: ariaLabel || title || "OutClass QR Code",
    }),
    [fgColor, bgColor, showLogo, title, ariaLabel],
  );

  const svgContent = useMemo(() => {
    if (!value) return "";
    try {
      return generateOutClassQRSVG(value, qrOptions);
    } catch {
      return "";
    }
  }, [value, qrOptions]);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setMessage("Link copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("Could not copy link automatically. Please copy the URL below.");
    }
  };

  const handleDownload = async (format: "png" | "svg") => {
    if (!svgContent) return;
    setDownloadBusy(true);
    setMessage("");
    try {
      if (format === "svg") {
        downloadQrSvg(svgContent, filename);
      } else {
        await downloadQrPng(svgContent, filename, 2048);
      }
    } catch (err) {
      setMessage(userMessage(err, "Download failed. Please retry."));
    } finally {
      setDownloadBusy(false);
    }
  };

  // The QR graphic element itself (always rendered on a light surface with high contrast)
  const qrElement = (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center rounded-2xl border border-border/80 bg-white p-3 shadow-sm select-none"
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
      }}
    >
      {svgContent ? (
        <div
          className="size-full [&>svg]:size-full [&>svg]:block"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      ) : (
        <div role="status" className="flex size-full items-center justify-center text-xs text-muted-foreground">
          Preparing QR code…
        </div>
      )}
    </div>
  );

  // Variant: Compact (just the QR code element)
  if (variant === "compact") {
    return (
      <div className={`inline-block ${className}`}>
        {qrElement}
      </div>
    );
  }

  // Variant: Print (optimized for flyers and print sheets)
  if (variant === "print") {
    return (
      <div className={`flex flex-col items-center gap-4 text-center ${className}`}>
        {title && <h3 className="oc-card-heading text-lg font-bold text-foreground">{title}</h3>}
        {qrElement}
        {description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
        {value && <p className="font-mono text-[11px] text-muted-foreground break-all">{value}</p>}
      </div>
    );
  }

  // Variant: Default (rich interactive card with downloads, copying, and caller actions)
  return (
    <section
      className={`rounded-2xl border border-border bg-white p-6 font-sans text-foreground shadow-none ${className}`}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="shrink-0">{qrElement}</div>

        <div className="min-w-0 flex-1 space-y-3">
          {title && <h3 className="oc-card-heading text-lg font-bold text-foreground">{title}</h3>}
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          )}

          {value && (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-sm font-medium text-blue-900 underline underline-offset-4 hover:text-blue-700"
            >
              {value}
            </a>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            {downloadable && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadBusy || !svgContent}
                  onClick={() => handleDownload("png")}
                  className="h-9 gap-1.5 border-border text-xs text-foreground shadow-none hover:bg-muted"
                >
                  <Download className="size-3.5" />
                  Download PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadBusy || !svgContent}
                  onClick={() => handleDownload("svg")}
                  className="h-9 gap-1.5 border-border text-xs text-foreground shadow-none hover:bg-muted"
                >
                  <Download className="size-3.5" />
                  Download SVG
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              disabled={!value}
              onClick={handleCopy}
              className="h-9 gap-1.5 border-border text-xs text-foreground shadow-none hover:bg-muted"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy link"}
            </Button>

            {actions}
          </div>

          {message && (
            <p role="status" className="text-xs text-muted-foreground pt-1">
              {message}
            </p>
          )}
        </div>
      </div>

    </section>
  );
}
