"use client"

import { useState } from "react"
import { ArrowLeft, Bell, Calendar, Check, Info, MapPin, Send, Sparkles, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ClubLogo } from "@/components/club-logo"
import { clubs, type DiscoverClub } from "@/lib/data"
import { useApplicationState } from "@/lib/application-state"
import type { ViewId } from "@/lib/views"

export function ClubProfileView({
  club,
  onBack,
  onNavigate,
}: {
  club: DiscoverClub
  onBack: () => void
  onNavigate: (view: ViewId) => void
}) {
  const { isApplied, applyToClub, managedEvents, events, respondToEvent, focusEvent, focusApplication } = useApplicationState()
  const [subscribed, setSubscribed] = useState(false)
  const applied = isApplied(club.id)

  const roster = clubs.find((c) => c.id === club.id)
  const infoSessions = managedEvents.filter((e) => e.clubId === club.id && e.scope === "Public")

  function rsvp(id: string) {
    const event = events.filter((event) => event.managedEventId === id && new Date(`${event.date}T23:59:59`) >= new Date()).sort((a,b) => a.date.localeCompare(b.date))[0]
    if (!event) { toast.info("No upcoming date is available for this event."); return }
    respondToEvent(event.id, "going")
    focusEvent(event.id)
    onNavigate("calendar")
  }

  function subscribe() {
    setSubscribed(true)
    toast.success(`You are now subscribed to notifications for ${club.logoText}.`)
  }

  function startApplication(e: React.FormEvent) {
    e.preventDefault()
    if (!applied) {
      applyToClub({ id: club.id, name: club.name, logoText: club.logoText, logoUrl: club.logoUrl, color: club.color })
    }
    focusApplication(club.id)
    onNavigate("tracker")
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground" onClick={onBack}>
        <ArrowLeft className="size-4" />
        Back to Discover
      </Button>

      {/* Cover banner + overlapping logo */}
      <div>
        <div className="h-32 w-full rounded-t-xl bg-foreground sm:h-40" aria-hidden="true" />
        <div className="rounded-b-xl border border-t-0 border-gray-200 bg-white px-4 pb-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <ClubLogo
                clubId={club.id} logoUrl={club.logoUrl} text={club.logoText}
                color="#051B3D"
                size="2xl"
                className="-mt-14 shrink-0 rounded-xl border-4 border-white font-bold shadow-none sm:-mt-16"
              />
              <div className="pt-3">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-sans">{club.name}</h1>
                <Badge variant="secondary" className="mt-1.5 text-[10px] font-medium">
                  {club.category}
                </Badge>
              </div>
            </div>

            <Button className="gap-1.5 bg-primary text-white hover:bg-primary/90" disabled={subscribed} onClick={subscribe}>
              {subscribed ? (
                <>
                  <Check className="size-4" />
                  Subscribed
                </>
              ) : (
                <>
                  <Bell className="size-4" />
                  Subscribe for Updates
                </>
              )}
            </Button>
          </div>

          {/* Quick facts */}
          <div className="mt-6 flex flex-wrap gap-1.5">
            {club.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-foreground/80"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Acceptance Rate", value: "8%" },
          { label: "AUM", value: "$2.4M" },
          { label: "Top Placements", value: "Goldman, Blackstone" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-lg font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Body tabs */}
      <Tabs defaultValue="about" className="gap-6">
        <TabsList>
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="sessions">Info Sessions</TabsTrigger>
          <TabsTrigger value="apply">Apply</TabsTrigger>
        </TabsList>

        <TabsContent value="about">
          <Card>
            <CardContent className="pt-6">
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{club.pitch}</p>
              <Separator className="my-5" />
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-foreground" />
                <h3 className="text-sm font-semibold font-sans tracking-tight">Why students apply</h3>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {["Real-world responsibility", "Mentorship from upperclassmen", "Recruiting pipeline", "Selective, tight-knit community"].map(
                  (t) => (
                    <li key={t} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="size-4 text-foreground" /> {t}
                    </li>
                  ),
                )}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardContent className="pt-6">
              {roster ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {roster.exec.map((person) => (
                    <div key={person.name} className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-muted text-xs font-medium">{person.initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{person.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{person.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Executive team profiles for {club.name} are coming soon.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground font-sans tracking-tight">Info Sessions & Key Dates</h3>
                <p className="text-sm text-muted-foreground">
                  Upcoming public sessions where you can learn more about {club.name} before applying.
                </p>
              </div>
              {infoSessions.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {infoSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex flex-col justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4"
                    >
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-foreground">{session.title}</p>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p className="flex items-center gap-1.5">
                            <Calendar className="size-3.5 shrink-0" /> {session.date} · {session.time}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <MapPin className="size-3.5 shrink-0" /> {session.location}
                          </p>
                          {session.zoomLink && (
                            <p className="flex items-center gap-1.5">
                              <Video className="size-3.5 shrink-0" /> Virtual option available
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="w-full gap-1.5 bg-primary text-white hover:bg-primary/90"
                        onClick={() => rsvp(session.id)}
                      >
                        <Check className="size-4" />
                        RSVP / Sync to Calendar
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No public info sessions are scheduled right now. Check back soon.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apply">
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-muted p-3">
                <Info className="mt-0.5 size-4 shrink-0 text-foreground" />
                <p className="text-sm text-foreground/90">
                  Your OutClass profile and resume will be automatically attached to this application.
                </p>
              </div>

              {applied ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 py-10 text-center">
                  <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
                    <Check className="size-5 text-foreground" />
                  </div>
                  <p className="text-sm font-medium">You&apos;ve already started this application</p>
                  <p className="text-sm text-muted-foreground">Track its progress in your Application Tracker.</p>
                  <Button className="mt-2" onClick={() => onNavigate("tracker")}>
                    Go to Application Tracker
                  </Button>
                </div>
              ) : (
                <form onSubmit={startApplication} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="why-club">{`Why ${club.name}?`}</Label>
                    <Input id="why-club" required placeholder="A concise, specific answer…" />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pitch">Tell us about a relevant project or experience</Label>
                    <Textarea id="pitch" required rows={8} placeholder="Keep it specific and evidence-based…" />
                  </div>

                  <Button type="submit" className="w-full gap-1.5 sm:w-auto">
                    <Send className="size-4" />
                    Start Application
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
