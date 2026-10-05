import Image from "next/image"

/** Whole-destination fallback. Keep known workspace content on its local skeletons. */
export function OutClassLoadingScreen({ variant = "light" }: { variant?: "light" | "navy" }) {
  return (
    <div className="oc-loading-screen" data-variant={variant} role="status" aria-busy="true">
      <Image
        src="/outclass-favicon-interlocking.png"
        alt=""
        aria-hidden="true"
        width={72}
        height={72}
        sizes="72px"
        priority
        className="oc-loading-mark"
      />
      <span className="sr-only">Loading OutClass</span>
    </div>
  )
}
