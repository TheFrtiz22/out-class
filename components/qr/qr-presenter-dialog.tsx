"use client";
import { userMessage } from "@/lib/user-message"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
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
  /**
   * Custom trigger element (rendered with asChild). Defaults to a "Present" button.
   * Pass `false` for a controlled dialog opened from elsewhere (e.g. `QrPresentButton`)
   * that must stay mounted while that button unmounts; focus still returns to it.
   */
  trigger?: ReactNode | false;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The current code is not valid yet: keep the dialog open and show a calm waiting state. */
  refreshing?: boolean;
  /** Why the last refresh failed, shown with a retry while `refreshing`. */
  error?: string;
  onRetry?: () => void;
}

const DEFAULT_SCAN_LINE = "Scan with your phone camera.";
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The standard "Present" trigger, for callers that open a controlled QrPresenterDialog. */
export function QrPresentButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={`h-9 gap-1.5 border-border text-xs text-foreground shadow-none hover:bg-muted ${className ?? ""}`}
      {...props}
    >
      <Maximize2 className="size-3.5" />
      Present
    </Button>
  );
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
  refreshing = false,
  error,
  onRetry,
}: QrPresenterDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const contentRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
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

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  // Remember what opened the dialog before Radix moves focus into it, so focus
  // returns there even when the dialog has no DialogTrigger (trigger={false}).
  useIsomorphicLayoutEffect(() => {
    if (open && typeof document !== "undefined") returnFocus.current = document.activeElement as HTMLElement | null;
  }, [open]);

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
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
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
      setMessage(userMessage(err, "Download failed. Please retry."));
    } finally {
      setBusy(false);
    }
  };

  const actionClass =
    "h-10 gap-1.5 border-border bg-white text-sm text-foreground shadow-none hover:bg-muted";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== false && (
        <DialogTrigger asChild>{trigger ?? <QrPresentButton disabled={!value} />}</DialogTrigger>
      )}
      <DialogContent
        ref={contentRef}
        data-qr-presenter=""
        overlayClassName="oc-qr-presenter-overlay"
        onCloseAutoFocus={(event) => {
          const target = returnFocus.current;
          if (target && target !== document.body && target.isConnected) {
            event.preventDefault();
            target.focus();
          }
        }}
        className="oc-qr-presenter flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col items-center justify-center gap-4 overflow-y-auto border-border bg-white p-4 text-center text-foreground sm:max-w-[calc(100vw-1rem)] sm:p-8 [&:fullscreen]:h-screen [&:fullscreen]:max-h-none [&:fullscreen]:w-screen [&:fullscreen]:max-w-none [&:fullscreen]:rounded-none [&:fullscreen]:border-0"
      >
        <div className="min-w-0 max-w-4xl">
          <DialogTitle className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
            {title}
          </DialogTitle>
          <DialogDescription className="mt-2 text-base text-muted-foreground">
            {description || DEFAULT_SCAN_LINE}
          </DialogDescription>
        </div>

        {refreshing ? (
          <div
            data-qr-refreshing=""
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-white p-8"
            style={{ width: size, height: size }}
          >
            <p role="status" className="text-lg font-medium text-foreground">Refreshing code…</p>
            {error && (
              <>
                <p role="alert" className="max-w-sm text-sm text-muted-foreground">{error}</p>
                {onRetry && (
                  <Button variant="outline" size="sm" onClick={onRetry} className={actionClass}>
                    Try again
                  </Button>
                )}
              </>
            )}
          </div>
        ) : (
        <>
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
              onClick={toggleFullscreen}
              className={actionClass}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              {isFullscreen ? "Exit full screen" : "Full screen"}
            </Button>
          )}
        </div>
        </>
        )}

        <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {message}
        </p>
      </DialogContent>
    </Dialog>
  );
}
