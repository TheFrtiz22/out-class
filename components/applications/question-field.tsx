"use client";
import { NativeSelect } from "@/components/ui/native-select"
import type { ApplicationQuestion } from "@/lib/student-applications";
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
    "aria-required": question.required,
    "aria-invalid": !!invalid,
    "aria-describedby": `help-${question.id}`,
  };
  if (question.type === "ESSAY")
    return (
      <Textarea
        {...props}
        rows={7}
        className="min-h-44 text-base leading-7"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Take your time. Write in your own voice."
      />
    );
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
