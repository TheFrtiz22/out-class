"use client"
import { useState } from "react"
import { SectionHeading } from "@/components/ui/section-heading"
import { PillGroup } from "@/components/ui/segmented-control"
import { SearchField } from "@/components/ui/search-field"
import { FilterChips } from "@/components/ui/filter-chips"
import { PillSelect } from "@/components/ui/pill-select"
import { Toggle } from "@/components/ui/toggle"
import { RangeSlider } from "@/components/ui/range-slider"
import { FilterPopover } from "@/components/ui/filter-popover"
import { DateField } from "@/components/ui/date-picker"
import { Stepper } from "@/components/ui/stepper"
import { Button } from "@/components/ui/button"

const interests = ["Academic", "Arts", "Business", "Community service", "Cultural", "Media", "Politics", "Pre-professional", "Religious", "Sports", "Technology"]

/** The /design-system reference for filter, search and view-switching controls. Local state only. */
export function FilterControlsReference() {
  const [query, setQuery] = useState("")
  const [period, setPeriod] = useState("all")
  const [interest, setInterest] = useState("all")
  const [major, setMajor] = useState("")
  const [saved, setSaved] = useState(false)
  const [gpa, setGpa] = useState<number | null>(null)
  const [date, setDate] = useState("")
  const [step, setStep] = useState("rooms")
  const active = [major, saved, gpa !== null, date].filter(Boolean).length
  return <section aria-labelledby="filters" className="space-y-6">
    <SectionHeading headingId="filters" title="Filters & search" description="One pill language for everything that narrows a view: navy active fill, cream text, the raised glass track." />
    <div className="oc-filter-bar" role="toolbar" aria-label="Example filters">
      <SearchField aria-label="Search example events" placeholder="Search events…" value={query} onChange={event => setQuery(event.target.value)} onClear={() => setQuery("")} shortcut="/" />
      <PillGroup label="Example date range" value={period} onChange={setPeriod} options={[{ value: "all", label: "All Events" }, { value: "today", label: "Today" }, { value: "week", label: "This Week" }, { value: "weekend", label: "Weekend" }]} />
      <FilterPopover count={active} title="Example filters" footer={<Button variant="ghost" size="sm" onClick={() => { setMajor(""); setSaved(false); setGpa(null); setDate("") }}>Clear filters</Button>}>
        <Toggle label="Saved events" checked={saved} onCheckedChange={setSaved} />
        <PillSelect label="Major" allLabel="All majors" value={major} onChange={setMajor} options={["Economics", "History", "Physics"].map(value => ({ value, label: value }))} />
        <DateField label="Example date" value={date} onChange={setDate} />
        <RangeSlider label="GPA greater than" min={0} max={4} step={0.1} value={gpa} onChange={setGpa} />
      </FilterPopover>
    </div>
    <FilterChips label="Example interests" visible={5} value={interest} onChange={setInterest} options={[{ value: "all", label: "All", count: 64 }, ...interests.map((value, index) => ({ value, label: value, count: 3 + index }))]} />
    <Stepper label="Example workflow" current={step} onSelect={setStep} steps={[{ id: "availability", label: "Availability", complete: true }, { id: "rooms", label: "Set interview times" }, { id: "review", label: "Confirm interviewers" }, { id: "publish", label: "Publish schedule" }]} />
  </section>
}
