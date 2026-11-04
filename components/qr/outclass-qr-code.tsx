"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Download, Copy, Maximize2, X, Check } from "lucide-react";
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
  /** Enable full-screen presentation mode for projectors and meeting displays */
  presenterMode?: boolean;
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
  presenterMode = false,
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
  const [isPresenterOpen, setIsPresenterOpen] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [message, setMessage] = useState("");
  const titleId = useId();

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
      setMessage(err instanceof Error ? err.message : "Download failed. Please retry.");
    } finally {
      setDownloadBusy(false);
    }
  };

  // The QR graphic element itself (always rendered on a light surface with high contrast)
  const qrElement = (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center rounded-2xl border border-neutral-200/80 bg-white p-3 shadow-sm select-none"
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
        <div role="status" className="flex size-full items-center justify-center text-xs text-neutral-400">
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
        {title && <h3 className="oc-card-heading text-lg font-bold text-neutral-900">{title}</h3>}
        {qrElement}
        {description && <p className="text-xs text-neutral-600 max-w-xs">{description}</p>}
        {value && <p className="font-mono text-[11px] text-neutral-500 break-all">{value}</p>}
      </div>
    );
  }

  // Variant: Default (rich interactive card with downloads, copying, and presenter mode)
  return (
    <section
      className={`rounded-2xl border border-neutral-200 bg-white p-6 font-sans text-neutral-900 shadow-none dark:border-neutral-800 dark:bg-white dark:text-neutral-950 ${className}`}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="shrink-0">{qrElement}</div>

        <div className="min-w-0 flex-1 space-y-3">
          {title && <h3 className="oc-card-heading text-lg font-bold text-neutral-900">{title}</h3>}
          {description && (
            <p className="text-sm text-neutral-600 leading-relaxed">{description}</p>
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
                  className="h-9 gap-1.5 border-neutral-300 text-xs text-neutral-800 shadow-none hover:bg-neutral-50"
                >
                  <Download className="size-3.5" />
                  Download PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadBusy || !svgContent}
                  onClick={() => handleDownload("svg")}
                  className="h-9 gap-1.5 border-neutral-300 text-xs text-neutral-800 shadow-none hover:bg-neutral-50"
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
              className="h-9 gap-1.5 border-neutral-300 text-xs text-neutral-800 shadow-none hover:bg-neutral-50"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy link"}
            </Button>

            {presenterMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPresenterOpen(true)}
                className="h-9 gap-1.5 border-neutral-300 text-xs text-neutral-800 shadow-none hover:bg-neutral-50"
              >
                <Maximize2 className="size-3.5" />
                Present
              </Button>
            )}
          </div>

          {message && (
            <p role="status" className="text-xs text-neutral-500 pt-1">
              {message}
            </p>
          )}
        </div>
      </div>

      {/* Full-Screen Presenter Dialog */}
      {isPresenterOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setIsPresenterOpen(false)}
        >
          <div
            className="relative flex flex-col items-center justify-center rounded-3xl bg-white p-8 sm:p-12 text-center text-neutral-900 shadow-2xl max-w-xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsPresenterOpen(false)}
              className="absolute right-5 top-5 rounded-full p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Close presentation view"
            >
              <X className="size-5" />
            </button>

            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-2">
              OutClass Attendance
            </span>

            <h2 id={titleId} className="oc-page-title text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 mb-2">
              {title || "Scan to Check In"}
            </h2>

            {description && (
              <p className="text-sm text-neutral-600 max-w-sm mb-6">
                {description}
              </p>
            )}

            <div className="my-2 rounded-2xl border border-neutral-200 bg-white p-4 shadow-md">
              <div
                className="size-[320px] sm:size-[400px] [&>svg]:size-full [&>svg]:block"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            </div>

            <p className="mt-6 text-sm font-medium text-neutral-700">
              Point your phone’s camera at the QR code to confirm your presence.
            </p>

            {value && (
              <p className="mt-2 font-mono text-xs text-neutral-400 break-all max-w-xs">
                {value}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
