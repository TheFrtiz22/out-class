"use client"

import { useMemo, useState } from "react"
import {
  Plus,
  Play,
  Download,
  ChevronDown,
  ArrowUpDown,
  Check,
  MoreHorizontal,
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { screeningApplicants as seed, type ScreeningApplicant, type ScreeningStatus } from "@/lib/data"

const STATUS_STYLES: Record<ScreeningStatus, string> = {
  "Passed Auto-Filter": "bg-emerald-100 text-emerald-800 border-transparent",
  "Auto-Flagged": "bg-amber-100 text-amber-800 border-transparent",
  "Manually Approved": "bg-sky-100 text-sky-800 border-transparent",
  Rejected: "bg-rose-100 text-rose-700 border-transparent",
}

const QUICK_FILTERS = [
  { id: "sat", label: "SAT ≥ 1450" },
  { id: "gpa", label: "GPA ≥ 3.7" },
  { id: "major", label: "Commerce / McIntire" },
  { id: "passed", label: "Passed Automated Screening" },
] as const

const SAT_CUTOFF = 1450
const GPA_CUTOFF = 3.5

function satColor(score: number) {
  if (score < SAT_CUTOFF) return "text-rose-600 font-semibold"
  if (score >= 1500) return "text-emerald-600 font-semibold"
  return "text-foreground"
}

function gpaColor(gpa: number) {
  return gpa < GPA_CUTOFF ? "text-rose-600 font-semibold" : "text-foreground"
}

export function ScreeningDashboardView() {
  const [applicants, setApplicants] = useState<ScreeningApplicant[]>(seed)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [ruleSheetOpen, setRuleSheetOpen] = useState(false)

  const [satRuleOn, setSatRuleOn] = useState(true)
  const [gpaRuleOn, setGpaRuleOn] = useState(true)
  const [yearRuleOn, setYearRuleOn] = useState(false)
  const [satThreshold, setSatThreshold] = useState("1450")
  const [gpaThreshold, setGpaThreshold] = useState("3.5")

  const filtered = useMemo(() => {
    return applicants.filter((a) => {
      if (activeFilters.has("sat") && a.satScore < 1450) return false
      if (activeFilters.has("gpa") && a.gpa < 3.7) return false
      if (activeFilters.has("major") && a.major !== "Commerce") return false
      if (activeFilters.has("passed") && a.status !== "Passed Auto-Filter") return false
      return true
    })
  }, [applicants, activeFilters])

  const totalApplied = applicants.length + 236 // simulate the full 248 pipeline against our 12-row sample
  const autoRejected = applicants.filter((a) => a.status === "Rejected").length + 52
  const passedScreening = applicants.filter((a) => a.status !== "Rejected").length + 174
  const interviewSlotsLeft = 35

  const projectedRejects = applicants.filter((a) => {
    const satFail = satRuleOn && a.satScore < Number(satThreshold)
    const gpaFail = gpaRuleOn && a.gpa < Number(gpaThreshold)
    const yearFail = yearRuleOn && a.classYear === "2026"
    return satFail || gpaFail || yearFail
  }).length

  function toggleFilter(id: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((a) => a.id)))
    }
  }

  function updateStatus(id: string, status: ScreeningStatus) {
    setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
    toast.success(`${applicants.find((a) => a.id === id)?.name} → ${status}`)
  }

  function bulkReject() {
    setApplicants((prev) => prev.map((a) => (selected.has(a.id) ? { ...a, status: "Rejected" } : a)))
    toast.success(`Rejected ${selected.size} applicants`)
    setSelected(new Set())
  }

  function bulkAdvance() {
    setApplicants((prev) => prev.map((a) => (selected.has(a.id) ? { ...a, status: "Manually Approved" } : a)))
    toast.success(`Moved ${selected.size} applicants to Round 1 interview stage`)
    setSelected(new Set())
  }

  function sendBlast() {
    toast.success(`Blast email queued for ${selected.size} applicants`)
  }

  function applyRules() {
    setApplicants((prev) =>
      prev.map((a) => {
        const tags: string[] = []
        const satFail = satRuleOn && a.satScore < Number(satThreshold)
        const gpaFail = gpaRuleOn && a.gpa < Number(gpaThreshold)
        const yearFail = yearRuleOn && a.classYear === "2026"
        if (satFail) tags.push("Low SAT")
        if (gpaFail) tags.push("Low GPA")
        if (satFail || gpaFail || yearFail) {
          return { ...a, status: "Rejected" as ScreeningStatus, flagTags: tags }
        }
        return a
      }),
    )
    toast.success(`Auto-reject rules applied — ${projectedRejects} candidates rejected`)
    setRuleSheetOpen(false)
  }

  function runAutomation() {
    applyRules()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight font-sans">
            Virginia Consulting Group <span className="text-muted-foreground">— Candidate Pipeline</span>
          </h1>
          <p className="text-xs text-muted-foreground">Fall 2026 recruitment · high-volume screening</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setRuleSheetOpen(true)}>
            <Plus className="size-3.5" /> Add Filter Rule
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={runAutomation}>
            <Play className="size-3.5" /> Run Auto-Reject Automation
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => toast.success("CRM export started — outclass_vcg_pipeline.csv")}
          >
            <Download className="size-3.5" /> Export CRM (.csv)
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="py-0">
          <CardContent className="p-3.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Applied</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{totalApplied}</p>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="p-3.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Auto-Filtered / Rejected</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-600">{autoRejected}</p>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="p-3.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Passed Screening</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">{passedScreening}</p>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="p-3.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Interview Slots Remaining</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{interviewSlotsLeft}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => toggleFilter(f.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              activeFilters.has(f.id)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-transparent text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Batch actions bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
          <span className="text-xs font-medium">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={bulkReject}>
              Bulk Reject ({selected.size} selected)
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={bulkAdvance}>
              Bulk Move to Interview Stage
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={sendBlast}>
              <Mail className="size-3.5" /> Send Blast Email
            </Button>
          </div>
        </div>
      )}

      {/* Screening table */}
      <Card className="overflow-hidden py-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 [&_th]:h-12 [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                  <TableHead className="w-10 pl-4">
                    <Checkbox
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead className="w-36">Year &amp; Major</TableHead>
                  <TableHead className="w-24">
                    <span className="inline-flex items-center gap-1">
                      SAT <ArrowUpDown className="size-3" />
                    </span>
                  </TableHead>
                  <TableHead className="w-20">GPA</TableHead>
                  <TableHead className="w-40">Screening Status</TableHead>
                  <TableHead className="w-10 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id} data-state={selected.has(a.id) ? "selected" : undefined} className="text-xs [&_td]:h-16 [&_td]:py-4">
                    <TableCell className="pl-4">
                      <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleRow(a.id)} aria-label={`Select ${a.name}`} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarFallback className="bg-muted text-[10px] font-medium">{a.initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{a.name}</span>
                        {a.flagTags.map((tag) => (
                          <Badge key={tag} variant="outline" className="h-4 border-rose-200 bg-rose-50 px-1 text-[10px] font-normal text-rose-600">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.classYear} · {a.major}
                    </TableCell>
                    <TableCell className={cn("font-sans tabular-nums", satColor(a.satScore))}>{a.satScore}</TableCell>
                    <TableCell className={cn("font-sans tabular-nums", gpaColor(a.gpa))}>{a.gpa.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge className={cn("font-medium", STATUS_STYLES[a.status])} variant="outline">
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-6">
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-xs">
                          <DropdownMenuItem onClick={() => updateStatus(a.id, "Manually Approved")}>
                            Bypass Cutoff
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateStatus(a.id, "Manually Approved")}>
                            Move to Round 1 Interview
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => updateStatus(a.id, "Rejected")}
                          >
                            Reject
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No candidates match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Auto-rejection rule builder */}
      <Sheet open={ruleSheetOpen} onOpenChange={setRuleSheetOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle>Auto-Reject Rule Builder</SheetTitle>
            <SheetDescription>Configure criteria that automatically screen out candidates.</SheetDescription>
          </SheetHeader>

          <div className="space-y-5 p-4">
            {/* Rule 1: SAT */}
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Rule 1 — Test Score Threshold</p>
                <Switch checked={satRuleOn} onCheckedChange={setSatRuleOn} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <Select defaultValue="sat">
                  <SelectTrigger className="h-8 w-32 text-xs" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sat" className="text-xs">
                      SAT Score
                    </SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">&lt;</span>
                <Input
                  value={satThreshold}
                  onChange={(e) => setSatThreshold(e.target.value)}
                  className="h-8 w-24 text-xs"
                />
                <span className="text-muted-foreground">→ Auto-Reject &amp; Tag "Low SAT"</span>
              </div>
            </div>

            {/* Rule 2: GPA */}
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Rule 2 — Cumulative GPA Threshold</p>
                <Switch checked={gpaRuleOn} onCheckedChange={setGpaRuleOn} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <Select defaultValue="gpa">
                  <SelectTrigger className="h-8 w-36 text-xs" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpa" className="text-xs">
                      Cumulative GPA
                    </SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">&lt;</span>
                <Input
                  value={gpaThreshold}
                  onChange={(e) => setGpaThreshold(e.target.value)}
                  className="h-8 w-24 text-xs"
                />
                <span className="text-muted-foreground">→ Auto-Reject &amp; Tag "Low GPA"</span>
              </div>
            </div>

            {/* Rule 3: Class year */}
            <div className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Rule 3 — Graduation Year Filter</p>
                <Switch checked={yearRuleOn} onCheckedChange={setYearRuleOn} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Exclude</span>
                <Badge variant="outline" className="font-normal">
                  Class of 2026 (Seniors)
                </Badge>
                <span className="text-muted-foreground">→ Move to Screened Out</span>
              </div>
            </div>

            <Alert className="border-amber-200 bg-amber-50">
              <AlertDescription className="text-xs text-amber-800">
                Applying these 3 rules will auto-reject <span className="font-semibold">{projectedRejects}</span>{" "}
                candidates and send custom rejection email templates on{" "}
                <span className="font-semibold">Sep 20, 2026</span>.
              </AlertDescription>
            </Alert>
          </div>

          <SheetFooter className="border-t">
            <Button className="w-full" onClick={applyRules}>
              <Check className="size-4" /> Apply Rules &amp; Update List
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
