"use client"

import { useRef, useState, type DragEvent } from "react"
import { ImageIcon, Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"

type MediaUploaderProps = {
  value: string | null
  onChange: (url: string | null) => void
  label: string
  helpText: string
  shape: "circle" | "banner"
}

export function MediaUploader({ value, onChange, label, helpText, shape }: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (!file || !file.type.startsWith("image/")) return
    const url = URL.createObjectURL(file)
    onChange(url)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "group relative flex shrink-0 items-center justify-center overflow-hidden border border-dashed bg-muted/40 text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground",
            shape === "circle" ? "size-20 rounded-full" : "aspect-[3/1] w-full rounded-md",
            isDragging && "border-primary bg-muted text-foreground",
          )}
          aria-label={`Upload ${label}`}
        >
          {value ? (
            <img
              src={value || "/placeholder.svg"}
              alt={`${label} preview`}
              className="size-full object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <span className="flex flex-col items-center gap-1 px-2 text-center">
              <ImageIcon className="size-5" />
              <span className="text-[11px] font-medium leading-tight">Drop or click to upload</span>
            </span>
          )}
          {value && (
            <span className="absolute inset-0 hidden items-center justify-center bg-black/50 text-white group-hover:flex">
              <Upload className="size-5" />
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs text-muted-foreground">{helpText}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium hover:bg-secondary"
            >
              <Upload className="size-3.5" /> {value ? "Replace" : "Upload"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-destructive"
              >
                <X className="size-3.5" /> Remove
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
