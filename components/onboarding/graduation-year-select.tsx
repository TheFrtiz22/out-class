"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/** Step 3 of sign-up: graduation year. Its own chunk, so step 1 does not ship the Radix select. */
export function GraduationYearSelect({ value, onValueChange, years }: { value: string; onValueChange: (value: string) => void; years: readonly string[] }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id="onboarding-grad-year" className="h-11 w-full rounded-md border-border shadow-none">
        <SelectValue placeholder="Year" />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={y}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
