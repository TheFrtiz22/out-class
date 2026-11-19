import type { ComponentType } from "react";
import type { IconProps as PhosphorIconProps } from "phosphor-react-native";
import { useTheme } from "~/lib/theme";

export type IconProps = { size?: number; color?: string; weight?: "regular" | "fill" | "bold"; label?: string };
export type IconComponent = (props: IconProps) => React.JSX.Element;

/** Regular by default; Fill for selected destinations and saved states (AGENTS.md). Icons are
 * decorative unless given a label: the control that holds one carries the accessible name. */
export function createIcon(name: string, Glyph: ComponentType<PhosphorIconProps>): IconComponent {
  function Icon({ size = 24, color, weight = "regular", label }: IconProps) {
    const { colors } = useTheme();
    return (
      <Glyph size={size} color={color ?? colors.foreground} weight={weight} title={label} />
    );
  }
  Icon.displayName = name;
  return Icon;
}
