"use client"
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { initialPhotoCrop, photoCropRect, type PhotoCrop } from "@/lib/photo-crop";

export function ProfilePhotoCrop({ source, onSave, onCancel }: { source: string; onSave: (file: File) => Promise<void>; onCancel: () => void }) {
  const [crop, setCrop] = useState<PhotoCrop>(initialPhotoCrop);
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const image = useRef<HTMLImageElement | null>(null), canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    setLoaded(false); setError(""); image.current = null;
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => { if (active) { try { photoCropRect(img.naturalWidth, img.naturalHeight, initialPhotoCrop); image.current = img; setCrop(initialPhotoCrop); setLoaded(true); } catch (e) { setError((e as Error).message); } } };
    img.onerror = () => { if (active) setError("This image could not be opened. Choose another image."); };
    img.src = source;
    return () => { active = false; image.current = null; };
  }, [source]);
  useEffect(() => {
    if (!loaded || !image.current || !canvas.current) return;
    const img = image.current, rect = photoCropRect(img.naturalWidth, img.naturalHeight, crop);
    const context = canvas.current.getContext("2d");
    context?.clearRect(0, 0, 512, 512);
    context?.drawImage(img, rect.sx, rect.sy, rect.side, rect.side, 0, 0, 512, 512);
  }, [loaded, crop]);
  async function save() {
    if (!canvas.current || !loaded) return;
    setBusy(true); setError("");
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.current!.toBlob(b => b ? resolve(b) : reject(Error("Could not prepare this image.")), "image/png"));
      await onSave(new File([blob], "profile-photo.png", { type: "image/png" }));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save photo."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Crop profile photo" className="min-w-0 space-y-3 rounded-lg border p-3">
    <p className="text-sm font-medium">Crop & preview</p>
    <canvas ref={canvas} width={512} height={512} role="img" aria-label="Final profile photo preview" className="mx-auto aspect-square w-full max-w-64 rounded-full bg-muted" />
    {([ ["zoom", "Zoom", 1, 4], ["x", "Horizontal position", -1, 1], ["y", "Vertical position", -1, 1] ] as const).map(([key, label, min, max]) => <label key={key} className="block text-sm">{label}<input type="range" aria-label={label} className="mt-2 block w-full" min={min} max={max} step="0.01" value={crop[key]} disabled={!loaded || busy} onChange={e => setCrop({ ...crop, [key]: Number(e.target.value) })} /></label>)}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>Cancel crop</Button><Button type="button" disabled={!loaded || busy} onClick={save}>{busy ? "Preparing photo…" : "Use cropped photo"}</Button></div>
  </section>;
}
