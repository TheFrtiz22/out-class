import { useState } from "react";
import { ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import { Check, ChevronDown, FileText } from "~/components/icons";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Press, TARGET } from "~/components/ui";
import { haptics } from "~/lib/haptics";
import { fonts, useTheme } from "~/lib/theme";
import type { ApplicationQuestion } from "~/lib/types";
import { MAX_ANSWER_CHARACTERS, encodeSelections, isUploadedDocument, selectedOptions, shortAnswerLimit } from "./rules";

type Props = { question: ApplicationQuestion; value: string; onChange: (value: string) => void; onBlur?: () => void; invalid?: boolean; disabled?: boolean; index: number };

/** One answer control per question type, as the web's QuestionField: essay box, short answer, choice, select-all, text or link. */
export function QuestionField({ question, value, onChange, onBlur, invalid, disabled, index }: Props) {
  const { colors, radius, text } = useTheme();
  const { height } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const border = { borderRadius: radius.md, borderWidth: focused ? 2 : 1, borderColor: invalid ? colors.destructive : focused ? colors.ring : colors.input, backgroundColor: colors.card };
  const name = `Question ${index + 1}: ${question.prompt}`;
  const hint = question.required ? "Required" : "Optional";

  if (question.type === "MULTI_SELECT" && question.options?.length) {
    const chosen = selectedOptions(question, value);
    return (
      <View accessibilityLabel={`${name}. Select all that apply`} style={{ gap: 8 }}>
        {question.options.map(option => {
          const checked = chosen.includes(option);
          return (
            <Press key={option} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked, disabled: !!disabled }} accessibilityLabel={option} testID={`answer-${index + 1}-option`}
              onPress={() => {
                haptics.tick();
                // Keep the club's option order regardless of tap order.
                onChange(encodeSelections(question.options!.filter(item => item === option ? !checked : chosen.includes(item))));
              }}
              style={{ minHeight: TARGET, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius.md, borderWidth: 1, borderColor: invalid ? colors.destructive : colors.input, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 8 }}>
              <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: checked ? colors.primary : colors.input, backgroundColor: checked ? colors.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
                {checked ? <Check size={14} weight="bold" color={colors.primaryForeground} /> : null}
              </View>
              <Text variant="body" style={{ flex: 1 }}>{option}</Text>
            </Press>
          );
        })}
      </View>
    );
  }

  if (question.type === "MULTIPLE_CHOICE" && question.options?.length) {
    return (
      <>
        <Press disabled={disabled} testID={`answer-${index + 1}`} accessibilityLabel={`${name}. ${value || "Select an option"}`} accessibilityHint={hint} onPress={() => setOpen(true)}
          style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, ...border, borderWidth: 1, borderColor: invalid ? colors.destructive : colors.input }}>
          <Text variant="body" color={value ? colors.foreground : colors.mutedForeground} style={{ flex: 1 }}>{value || "Select an option"}</Text>
          <ChevronDown size={18} color={colors.mutedForeground} />
        </Press>
        <Sheet open={open} onClose={() => { setOpen(false); onBlur?.(); }} title={question.prompt.length > 80 ? `Question ${index + 1}` : question.prompt}>
          {/* A long list of choices scrolls inside the sheet instead of running off the screen. */}
          <ScrollView style={{ maxHeight: height * 0.6 }} showsVerticalScrollIndicator={question.options.length > 8}>
            <View accessibilityRole="radiogroup" style={{ gap: 4 }}>
              {/* The empty row clears an answer; it is offered only once there is one. */}
              {[...(value ? [""] : []), ...question.options].map(option => {
                const selected = option === value;
                return (
                  <Press key={option || "none"} large accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={option || "Clear selection"}
                    onPress={() => { haptics.tick(); onChange(option); setOpen(false); onBlur?.(); }}
                    style={{ minHeight: TARGET + 4, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: selected ? colors.contentSoft : "transparent" }}>
                    <Text variant={selected ? "bodyStrong" : "body"} color={option ? colors.foreground : colors.mutedForeground} style={{ flex: 1 }}>{option || "Clear selection"}</Text>
                    {selected ? <Check size={18} color={colors.brandInk} /> : null}
                  </Press>
                );
              })}
            </View>
          </ScrollView>
        </Sheet>
      </>
    );
  }

  const essay = question.type === "ESSAY";
  const link = question.type === "FILE_UPLOAD";
  // An uploaded PDF is stored as a private key, which means nothing to read: show it as an attachment.
  if (link && isUploadedDocument(value)) return (
    <View testID={`answer-${index + 1}`} accessibilityLabel={`${name}. PDF attached`} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 14, paddingRight: 4, paddingVertical: 4, ...border, borderWidth: 1, borderColor: invalid ? colors.destructive : colors.input }}>
      <FileText size={18} color={colors.mutedForeground} />
      <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>PDF attached</Text>
      <Button variant="ghost" size="compact" label="Remove" disabled={disabled} accessibilityHint="Removes the attached PDF from this answer" onPress={() => { haptics.tick(); onChange(""); onBlur?.(); }} />
    </View>
  );
  return (
    <TextInput
      testID={`answer-${index + 1}`}
      accessibilityLabel={name}
      accessibilityHint={hint}
      editable={!disabled}
      multiline={essay}
      scrollEnabled={false}
      maxLength={question.type === "SHORT_ANSWER" ? shortAnswerLimit(question) : MAX_ANSWER_CHARACTERS}
      value={value}
      // A short answer is one line: a pasted line break becomes a space.
      onChangeText={question.type === "SHORT_ANSWER" ? text => onChange(text.replace(/[\r\n]+/gu, " ")) : onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); onBlur?.(); }}
      placeholder={essay ? "Take your time. Write in your own voice." : link ? "https://…" : "Your response"}
      placeholderTextColor={colors.mutedForeground}
      autoCapitalize={link ? "none" : "sentences"}
      autoCorrect={!link}
      keyboardType={link ? "url" : "default"}
      returnKeyType={essay ? "default" : "done"}
      submitBehavior={essay ? "newline" : "blurAndSubmit"}
      style={{ ...border, minHeight: essay ? 200 : 48, paddingHorizontal: focused ? 13 : 14, paddingVertical: essay ? (focused ? 11 : 12) : 0, fontFamily: fonts.sans, fontSize: Math.max(16, text.body), lineHeight: essay ? Math.max(16, text.body) * 1.55 : undefined, color: colors.foreground, textAlignVertical: essay ? "top" : "center", opacity: disabled ? 0.6 : 1 }}
    />
  );
}
