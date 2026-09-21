'use client'

import { useState } from "react"
import { ArrowRight, Bell, FileText, Plus } from "lucide-react"
import { toast } from "sonner"
import { OutClassLogo } from "@/components/outclass-logo"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Search } from "@/components/ui/search"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Surface } from "@/components/ui/surface"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { SectionHeading } from "@/components/ui/section-heading"
import { EmptyState } from "@/components/ui/empty-state"
import { Divider } from "@/components/ui/divider"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

/** Isolated visual reference. No account mutations or fixture persistence. */
export default function DesignSystemPage() {
  const [progress, setProgress] = useState(40)
  return <main className="mx-auto max-w-5xl space-y-section px-page py-section">
    <header className="space-y-6 entrance">
      <OutClassLogo className="h-12 w-auto" />
      <p className="text-caption uppercase tracking-widest text-muted-foreground">Design foundations · component reference</p>
      <h1 className="max-w-2xl font-display text-display font-normal">A considered place for your next chapter.</h1>
      <p className="max-w-xl text-body text-muted-foreground">Editorial character for meaningful moments. Clear, quiet tools for everyday work.</p>
    </header>
    <Divider />
    <section aria-labelledby="palette" className="space-y-6">
      <SectionHeading headingId="palette" title="Color & hierarchy" description="White surfaces, warm canvas, navy actions. Orange is a deliberate accent." />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[
        ["Canvas", "bg-background"], ["Surface", "bg-card"], ["Primary", "bg-primary"], ["Signature", "bg-brand-orange"],
      ].map(([label, color]) => <div key={label}><div aria-hidden="true" className={`mb-2 h-16 rounded-md border border-border ${color}`} /><p className="text-sm">{label}</p></div>)}</div>
      <div className="flex flex-wrap gap-2"><Badge>Neutral</Badge><Badge variant="accent">UVA community</Badge><Badge variant="success">Success</Badge><Badge variant="warning">Warning</Badge><Badge variant="destructive">Error</Badge><Badge variant="info">Information</Badge></div>
      <div className="flex flex-wrap gap-2">{["DRAFTING", "SUBMITTED", "IN_REVIEW", "INTERVIEWING", "ACCEPTED", "REJECTED", "WAITLISTED"].map(status => <StatusBadge key={status} status={status} />)}</div>
    </section>
    <Divider />
    <section aria-labelledby="controls" className="space-y-6">
      <SectionHeading headingId="controls" title="Actions & inputs" />
      <div className="flex flex-wrap items-center gap-3"><Button>Continue<ArrowRight /></Button><Button variant="outline">Save draft</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Cancel</Button><Button variant="accent">Explore UVA</Button><Button variant="destructive">Remove</Button><Button disabled>Unavailable</Button><IconButton aria-label="Add example item" onClick={() => toast("Example item added")}><Plus /></IconButton></div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="ds-name">Preferred name</Label><Input id="ds-name" placeholder="Your name" autoComplete="given-name" /></div>
        <div className="space-y-2"><Label htmlFor="ds-search">Search clubs</Label><Search id="ds-search" aria-label="Search example clubs" placeholder="Search by name or interest" /></div>
        <div className="space-y-2"><Label htmlFor="ds-select">Recruitment term</Label><Select defaultValue="fall"><SelectTrigger id="ds-select" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fall">Fall semester</SelectItem><SelectItem value="spring">Spring semester</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="ds-error">Email</Label><Input id="ds-error" aria-invalid="true" aria-describedby="ds-error-message" defaultValue="student@example.com" /><p id="ds-error-message" className="text-sm text-destructive">Use your UVA email address.</p></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="ds-bio">Introduction</Label><Textarea id="ds-bio" placeholder="A little about your interests…" /></div>
      </div>
    </section>
    <Divider />
    <section aria-labelledby="structure" className="space-y-6">
      <SectionHeading headingId="structure" title="Room to focus" editorial description="Start with whitespace and a divider. Add a container only when grouping helps." />
      <Tabs defaultValue="overview"><TabsList variant="underline" aria-label="Example sections"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="details">Details</TabsTrigger></TabsList><TabsContent value="overview" className="pt-4"><Surface><div className="flex items-center gap-3"><Avatar aria-label="Sample student"><AvatarFallback>ST</AvatarFallback></Avatar><div><p className="text-sm font-medium">Student profile</p><p className="text-sm text-muted-foreground">A simple row, without another card.</p></div></div></Surface></TabsContent><TabsContent value="details" className="pt-4"><Surface tone="subtle">Supporting information lives here.</Surface></TabsContent></Tabs>
      <Card><CardHeader><CardTitle>One meaningful container</CardTitle><CardDescription>Use when content needs a distinct boundary.</CardDescription></CardHeader><CardContent className="space-y-3"><Progress value={progress} aria-label="Example profile completion" /><Button variant="outline" size="sm" onClick={() => setProgress(value => value >= 100 ? 0 : value + 20)}>Update progress</Button></CardContent></Card>
      <EmptyState icon={<FileText />} title="Nothing here yet" description="A useful next step is more helpful than an empty dashboard." action={<Button variant="outline" onClick={() => toast("Example action")}>Discover clubs</Button>} />
      <div role="status" aria-label="Loading example content" className="space-y-3"><Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-full max-w-sm" /><span className="sr-only">Loading…</span></div>
    </section>
    <Divider />
    <section aria-labelledby="overlays" className="space-y-6">
      <SectionHeading headingId="overlays" title="Overlays & feedback" description="Try keyboard navigation, Escape, focus return, and reduced motion." />
      <div className="flex flex-wrap items-center gap-3">
        <Dialog><DialogTrigger asChild><Button variant="outline">Open dialog</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>A moment to review</DialogTitle><DialogDescription>Dialogs are reserved for focused tasks. This example does not save any data.</DialogDescription></DialogHeader><DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><DialogClose asChild><Button>Done</Button></DialogClose></DialogFooter></DialogContent></Dialog>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline">More actions</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={() => toast("Example action selected")}>View details</DropdownMenuItem><DropdownMenuItem disabled>Unavailable action</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        <Tooltip><TooltipTrigger asChild><IconButton aria-label="Example notifications" onClick={() => toast.info("No new notifications")}><Bell /></IconButton></TooltipTrigger><TooltipContent>Notifications</TooltipContent></Tooltip>
        <Button variant="ghost" onClick={() => toast.success("Changes saved", { description: "Example feedback only." })}>Show toast</Button>
      </div>
    </section>
  </main>
}
