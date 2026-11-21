import { View } from "react-native";
import { Check } from "~/components/icons";
import { Text } from "~/components/text";
import { Press, TARGET } from "~/components/ui";
import { haptics } from "~/lib/haptics";
import { useTheme } from "~/lib/theme";

type Option<T extends string> = { value: T; label: string; disabled?: boolean };
type Common<T extends string> = { label: string; options: readonly Option<T>[]; disabled?: boolean; testID?: string };
type Single<T extends string> = Common<T> & { multiple?: false; value: T | null; onChange: (value: T | null) => void };
type Multiple<T extends string> = Common<T> & { multiple: true; value: T[]; onChange: (value: T[]) => void };

/**
 * Wrapping outlined chips for a question with several answers (the web's FilterChips chip rows).
 * With `multiple`, each chip toggles; otherwise choosing the selected chip again clears the answer.
 */
export function ChoiceChips<T extends string>(props: Single<T> | Multiple<T>) {
  const { colors, radius } = useTheme();
  const { label, options, disabled, testID } = props;
  const selected = (value: T) => props.multiple ? props.value.includes(value) : props.value === value;
  function press(value: T) {
    haptics.tick();
    if (props.multiple) props.onChange(selected(value) ? props.value.filter(item => item !== value) : [...props.value, value]);
    else props.onChange(selected(value) ? null : value);
  }
  return (
    <View accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map(option => {
        const on = selected(option.value), off = disabled || (option.disabled && !on);
        return (
          <Press key={option.value} testID={testID ? `${testID}-${option.value.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}` : undefined}
            accessibilityRole={props.multiple ? "checkbox" : "radio"} accessibilityLabel={option.label}
            accessibilityState={props.multiple ? { checked: on, disabled: !!off } : { selected: on, disabled: !!off }}
            disabled={off} onPress={() => press(option.value)}
            style={{ minHeight: TARGET, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%", borderRadius: radius.full, borderWidth: 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card }}>
            {on ? <Check size={16} color={colors.primaryForeground} /> : null}
            <Text variant="smallStrong" color={on ? colors.primaryForeground : colors.foreground} style={{ flexShrink: 1 }}>{option.label}</Text>
          </Press>
        );
      })}
    </View>
  );
}
