import { cn } from "@/lib/utils"

const sizeMap = {
  sm: "size-8 text-xs rounded-md",
  md: "size-11 text-sm rounded-lg",
  lg: "size-16 text-lg rounded-lg",
  xl: "size-20 text-xl rounded-lg",
  "2xl": "size-28 text-3xl rounded-xl sm:size-32",
}

export function ClubLogo({
  text,
  color,
  size = "md",
  className,
}: {
  text: string
  color: string
  size?: keyof typeof sizeMap
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold tracking-tight text-white shadow-none",
        sizeMap[size],
        className,
      )}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {text}
    </div>
  )
}
