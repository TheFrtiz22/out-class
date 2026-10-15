import Image from "next/image"

/** Whole-destination fallback. Keep known workspace content on its local skeletons. */
export function OutClassLoadingScreen({ variant = "light" }: { variant?: "light" | "navy" }) {
  return (
    <div className="oc-loading-screen" data-variant={variant} role="status" aria-busy="true">
      <Image
        src={variant === "navy" ? "/brand/premium-board/06_app_icon_light.svg" : "/brand/premium-board/07_favicon.svg"}
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
