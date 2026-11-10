"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Download, Maximize2, Minimize2 } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { OutClassQRCode } from "@/components/qr/outclass-qr-code";
import { generateOutClassQRSVG } from "@/lib/qr/renderer";
import { downloadQrPng, downloadQrSvg } from "@/lib/qr/export";
import { BRAND_IVORY, BRAND_NAVY } from "@/lib/qr/constants";

export interface QrPresenterDialogProps {
  /** Exact URL encoded in the QR. Callers own which link this is (short link, rotation). */
  value: string;
  /** Event, meeting or session name; also the dialog's accessible name. */
  title: string;
  /** Optional line under the title. */
  description?: string;
  /** Base filename for PNG/SVG export, without extension. */
  filename?: string;
  /** Accessible label for the QR image itself. */
  ariaLabel?: string;
  /** Custom trigger element (rendered with asChild). Defaults to a "Present" button. */
  trigger?: ReactNode;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Readable form of a link for a projector: no scheme, no trailing slash. */
export function readableQrLink(value: string): string {
  return value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

const MIN_QR = 240;
const MAX_QR = 1200;

/** Largest square that fits the viewport with room for the title, link and actions. */
function viewportQrSize(): number {
  if (typeof window === "undefined") return 480;
  const fit = Math.min(window.innerWidth - 48, window.innerHeight - 280);
  return Math.max(MIN_QR, Math.min(MAX_QR, Math.floor(fit)));
}

function useViewportQrSize(active: boolean): number {
  const [size, setSize] = useState(480);
  useEffect(() => {
    if (!active) return;
    const update = () => setSize(viewportQrSize());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [active]);
  return size;
}

export function QrPresenterDialog({
  value,
  title,
  description,
  filename = "outclass-qr",
  ariaLabel,
  trigger,
  open: openProp,
  onOpenChange,
}: QrPresenterDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const contentRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const size = useViewportQrSize(open);
  const label = ariaLabel || `QR code for ${title}`;

  // Same options OutClassQRCode renders with, so exports match what is on screen.
  const svgContent = useMemo(() => {
    if (!value) return "";
    try {
      return generateOutClassQRSVG(value, {
        fgColor: BRAND_NAVY,
        bgColor: BRAND_IVORY,
        showLogo: true,
        title,
        ariaLabel: label,
      });
    } catch {
      return "";
    }
  }, [value, title, label]);

  const exitFullscreen = useCallback(() => {
    if (typeof document !== "undefined" && document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const setOpen = (next: boolean) => {
    if (!next) {
      exitFullscreen();
      setMessage("");
    }
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open) return;
    setFullscreenSupported(Boolean(document.fullscreenEnabled));
    const sync = () => setIsFullscreen(document.fullscreenElement === contentRef.current && !!contentRef.current);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      exitFullscreen();
    };
  }, [open, exitFullscreen]);

  const toggleFullscreen = async () => {
    const node = contentRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await node.requestFullscreen();
    } catch {
      setMessage("Full screen is not available in this browser.");
    }
  };

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setMessage("Link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("Could not copy automatically. Copy the link shown above.");
    }
  };

  const handleDownload = async (format: "png" | "svg") => {
    if (!svgContent) return;
    setBusy(true);
    setMessage("");
    try {
      if (format === "svg") downloadQrSvg(svgContent, filename);
      else await downloadQrPng(svgContent, filename, 2048);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Download failed. Please retry.");
    } finally {
      setBusy(false);
    }
  };

  const actionClass =
    "h-10 gap-1.5 border-border bg-white text-sm text-foreground shadow-none hover:bg-muted";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            size="sm"
            disabled={!value}
            className="h-9 gap-1.5 border-border text-xs text-foreground shadow-none hover:bg-muted"
          >
            <Maximize2 className="size-3.5" />
            Present
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        ref={contentRef}
        data-qr-presenter=""
        className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col items-center justify-center gap-4 overflow-y-auto border-border bg-white p-4 text-center text-foreground sm:max-w-[calc(100vw-1rem)] sm:p-8 motion-reduce:animate-none [&:fullscreen]:h-screen [&:fullscreen]:max-h-none [&:fullscreen]:w-screen [&:fullscreen]:max-w-none [&:fullscreen]:rounded-none [&:fullscreen]:border-0"
      >
        <div className="min-w-0 max-w-4xl">
          <DialogTitle className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
            {title}
          </DialogTitle>
          <DialogDescription className={description ? "mt-2 text-base text-muted-foreground" : "sr-only"}>
            {description || "Scan the QR code with a phone camera."}
          </DialogDescription>
        </div>

        <OutClassQRCode
          value={value}
          size={size}
          variant="compact"
          showLogo={true}
          title={title}
          ariaLabel={label}
          filename={filename}
          fgColor={BRAND_NAVY}
          bgColor={BRAND_IVORY}
        />

        {value && (
          <p
            data-qr-link=""
            className="max-w-4xl break-all font-mono text-lg font-semibold text-foreground sm:text-2xl"
          >
            {readableQrLink(value)}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={!value} onClick={handleCopy} className={actionClass}>
            {copied ? <Check className="size-4 text-emerald-700" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !svgContent}
            onClick={() => handleDownload("png")}
            className={actionClass}
          >
            <Download className="size-4" />
            Download PNG
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !svgContent}
            onClick={() => handleDownload("svg")}
            className={actionClass}
          >
            <Download className="size-4" />
            Download SVG
          </Button>
          {fullscreenSupported && (
            <Button
              variant="outline"
              size="sm"
              aria-pressed={isFullscreen}
              onClick={toggleFullscreen}
              className={actionClass}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              {isFullscreen ? "Exit full screen" : "Full screen"}
            </Button>
          )}
        </div>

        <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {message}
        </p>
      </DialogContent>
    </Dialog>
  );
}
