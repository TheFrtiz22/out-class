import { type ComponentRef, type Ref, useState } from "react";
import { TextInput, type TextInputProps, View } from "react-native";
import { Text } from "~/components/text";
import { fonts, useTheme } from "~/lib/theme";

export type FieldRef = ComponentRef<typeof TextInput>;
type Props = TextInputProps & { label: string; hint?: string; error?: string; ref?: Ref<FieldRef> };

/** A labelled text field: visible label, the one focus ring colour, 44pt minimum height. */
export function Field({ label, hint, error, style, onFocus, onBlur, multiline, editable, ref, ...rest }: Props) {
  const { colors, radius, text } = useTheme();
  const [focused, setFocused] = useState(false);
  const locked = editable === false;
  return (
    <View style={{ gap: 6 }}>
      <Text variant="smallStrong">{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        // A screen reader reads the problem with the field, not only when the alert is announced.
        accessibilityHint={error ? (hint ? `${error} ${hint}` : error) : hint}
        accessibilityState={{ disabled: locked }}
        placeholderTextColor={colors.mutedForeground}
        selectionColor={colors.ring}
        cursorColor={colors.foreground}
        multiline={multiline}
        editable={editable}
        maxFontSizeMultiplier={2}
        {...rest}
        onFocus={event => { setFocused(true); onFocus?.(event); }}
        onBlur={event => { setFocused(false); onBlur?.(event); }}
        style={[{ minHeight: multiline ? 120 : 48, borderRadius: radius.md, borderWidth: focused ? 2 : 1, borderColor: error ? colors.destructive : focused ? colors.ring : colors.input, backgroundColor: locked ? colors.muted : colors.card, paddingHorizontal: focused ? 13 : 14, paddingVertical: multiline ? 12 : 10, fontFamily: fonts.sans, fontSize: Math.max(16, text.body), color: locked ? colors.mutedForeground : colors.foreground, textAlignVertical: multiline ? "top" : "center" }, style]}
      />
      {error ? <Text variant="caption" color={colors.destructive} accessibilityRole="alert">{error}</Text> : hint ? <Text variant="caption">{hint}</Text> : null}
    </View>
  );
}
