import type { ReactElement } from "react"
import type { Icon as PhosphorIcon, IconProps as PhosphorIconProps } from "@phosphor-icons/react"

export type IconProps = PhosphorIconProps & { title?: string }
export type IconComponent = (props: IconProps) => ReactElement

/** Native SVGs with no client context, safe in both Server and Client Components.
 * Keep shared sizing, ref forwarding, selectors, and decorative defaults.
 * Use regular for controls and fill for selected destinations or saved items.
 */
export function createIcon(name: string, Glyph: PhosphorIcon): IconComponent {
  function Icon({ size = 24, color = "currentColor", weight = "regular", className, title, alt, children, ...props }: IconProps) {
    const label = title ?? alt
    const named = Boolean(label || props["aria-label"] || props["aria-labelledby"])
    return (
      <Glyph
        size={size}
        color={color}
        weight={weight}
        alt={label}
        focusable="false"
        aria-hidden={named ? undefined : true}
        role={named ? "img" : undefined}
        className={className ? `oc-icon ${className}` : "oc-icon"}
        data-icon-pack="phosphor"
        data-icon={name}
        data-icon-weight={weight}
        {...props}
      >
        {children}
      </Glyph>
    )
  }
  Icon.displayName = name
  return Icon
}
