"use client";
import { NativeSelect } from "@/components/ui/native-select"
import { encodeSelections, selectedOptions, type ApplicationQuestion } from "@/lib/student-applications";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
export function QuestionField({
  question,
  value,
  onChange,
  invalid,
  disabled = false,
}: {
  question: ApplicationQuestion;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const props = {
    id: `answer-${question.id}`,
    disabled,
    required: question.required,
    "aria-required": question.required,
    "aria-invalid": !!invalid,
    "aria-describedby": `help-${question.id}`,
  };
  if (question.type === "ESSAY")
    return (
      <Textarea
        {...props}
        rows={9}
        className="oc-writing-textarea min-h-56 resize-y text-base leading-7 sm:min-h-64"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Take your time. Write in your own voice."
      />
    );
  if (question.type === "MULTI_SELECT" && question.options?.length) {
    const chosen = selectedOptions(question, value);
    return (
      <fieldset id={props.id} aria-describedby={props["aria-describedby"]} aria-invalid={props["aria-invalid"]} disabled={disabled} className="space-y-2" tabIndex={-1}>
        <legend className="sr-only">Select all that apply</legend>
        {question.options.map((option) => (
          <label key={option} className="flex min-h-11 items-center gap-3 rounded-md border px-4 py-2 text-sm">
            <Checkbox
              checked={chosen.includes(option)}
              onCheckedChange={(checked) => {
                // Keep the club's option order regardless of click order.
                const next = question.options!.filter((item) => item === option ? checked === true : chosen.includes(item));
                onChange(encodeSelections(next));
              }}
            />
            {option}
          </label>
        ))}
      </fieldset>
    );
  }
  if (question.type === "MULTIPLE_CHOICE" && question.options?.length)
    return (
      <NativeSelect
        {...props}
        className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select an option</option>
        {question.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </NativeSelect>
    );
  return (
    <Input
      {...props}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={
        question.type === "FILE_UPLOAD" ? "https://…" : "Your response"
      }
    />
  );
}
