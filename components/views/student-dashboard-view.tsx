"use client"

import { useState } from "react"
import { ArrowUpRight, Clock, Compass, Sparkles, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ClubLogo } from "@/components/club-logo"
import { StatusBadge } from "@/components/status-badge"
import { ApplicationStatusStepper } from "@/components/application-status-stepper"
import { applications, type Application } from "@/lib/data"
import { useApplicationState } from "@/lib/application-state"
import type { ViewId } from "@/lib/views"

export function StudentDashboardView({ onNavigate }: { onNavigate: (view: ViewId) => void }) {
  const [showNotification, setShowNotification] = useState(true)
  const { focusApplication } = useApplicationState()

  const draftApplications = applications.filter((a) => a.stage === "Draft")
  const submittedApplications = applications.filter((a) => a.stage !== "Draft")
  const hasNoActivity = draftApplications.length === 0 && submittedApplications.length === 0

  // Routes to the Application Tracker and opens the canvas for this specific
  // application (matched by clubId), so "Continue" lands on the right draft.
  const handleContinueApplication = (app: Application) => {
    focusApplication(app.clubId)
    onNavigate("tracker")
  }

  const handleViewApplication = (app: Application) => {
    focusApplication(app.clubId)
    onNavigate("tracker")
  }

  return (
    <div className="space-y-8">
      {/* Top Alert Banner — full width */}
      {showNotification && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted p-4 shadow-none">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status update</p>
            <p className="text-sm leading-snug text-foreground">
              You have been invited to a <span className="font-semibold">First Round Interview</span> for Virginia
              Venture Fund.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setShowNotification(false)}
            className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {hasNoActivity ? (
        <Card className="border-gray-200 bg-white">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-foreground/5">
              <Compass className="size-8 text-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">No active applications yet</h3>
              <p className="mx-auto max-w-sm text-sm text-gray-500">
                Explore clubs on campus and start an application to see your progress and status here.
              </p>
            </div>
            <Button className="bg-primary text-white hover:bg-primary/90" onClick={() => onNavigate("discover")}>
              Discover Clubs
              <ArrowUpRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Section 1 — Drafts in Progress (grid) */}
          {draftApplications.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Drafts in Progress</h2>
                  <p className="text-sm text-gray-500">
                    {draftApplications.length} application{draftApplications.length === 1 ? "" : "s"} in progress
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate("discover")}
                  className="border-gray-300 bg-white text-foreground hover:bg-gray-50"
                >
                  Browse
                  <ArrowUpRight className="size-4" />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {draftApplications.map((app) => {
                  const percent = Math.floor(((app.essaysWritten ?? 0) / (app.essaysTotal ?? 1)) * 100)
                  return (
                    <Card key={app.id} className="border-gray-200 bg-white">
                      <CardHeader className="flex-row items-center gap-3 space-y-0">
                        <ClubLogo text={app.logoText} color={app.color} />
                        <div className="min-w-0 flex-1">
                          <CardTitle className="truncate text-sm text-foreground">{app.clubName}</CardTitle>
                          <p className="text-xs font-medium text-red-600">{app.deadline}</p>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-1.5">
                          <Progress value={percent} className="h-2" />
                          <p className="text-xs text-gray-500">
                            {percent}% Complete • {app.essaysWritten} of {app.essaysTotal} essays written
                          </p>
                        </div>
                        <Button
                          className="w-full bg-primary text-white hover:bg-primary/90"
                          onClick={() => handleContinueApplication(app)}
                        >
                          Continue Application
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* Section 2 — Submitted Applications (full-width list) */}
          {submittedApplications.length > 0 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-foreground">Submitted Applications</h2>
                <p className="text-sm text-gray-500">
                  {submittedApplications.length} application{submittedApplications.length === 1 ? "" : "s"} under
                  review
                </p>
              </div>

              <div className="space-y-3">
                {submittedApplications.map((app) => (
                  <Card
                    key={app.id}
                    className="border-gray-200 bg-white transition-colors hover:border-foreground/30"
                  >
                    <CardContent className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:gap-6">
                      {/* Left — logo & name */}
                      <div className="flex items-center gap-3 lg:w-56 lg:shrink-0">
                        <ClubLogo text={app.logoText} color={app.color} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{app.clubName}</p>
                          <p className="text-xs text-gray-500">Submitted {app.submitted}</p>
                        </div>
                      </div>

                      {/* Middle — stepper */}
                      <div className="min-w-0 flex-1">
                        <ApplicationStatusStepper app={app} />
                      </div>

                      {/* Right — next step & action */}
                      <div className="flex flex-col items-start gap-2 lg:w-64 lg:shrink-0 lg:items-end">
                        <StatusBadge status={app.stage} />
                        <div className="flex items-center gap-2 text-xs text-gray-600 lg:justify-end lg:text-right">
                          <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                          <span>
                            <span className="font-medium text-foreground">Next:</span> {app.nextStep}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-gray-300 bg-white text-gray-600 hover:bg-gray-50 lg:w-auto"
                          onClick={() => handleViewApplication(app)}
                        >
                          View Application
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
