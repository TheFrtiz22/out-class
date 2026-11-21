import { OptionPicker } from "~/components/option-picker";

/**
 * A single-choice filter (the web's PillSelect options laid out for touch). It wraps instead of
 * scrolling sideways; past `inline` options (12 unless the screen picks fewer) the rest sit behind a "More" chip (see OptionPicker).
 */
export function FilterChips<T extends string>({ label, options, value, onChange, testID, inline = 12, moreLabel }: { label: string; options: readonly { value: T; label: string; count?: number }[]; value: T; onChange: (value: T) => void; testID?: string; inline?: number; moreLabel?: string }) {
  return <OptionPicker label={label} options={options} value={value} onChange={onChange} testID={testID} inline={inline} moreLabel={moreLabel} />;
}
