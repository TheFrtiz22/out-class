"use client"

import { useState } from "react"
import { Camera, FileText, GraduationCap, Linkedin, Plus, ShieldCheck, Trash2, Upload } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { EditStudentProfileDialog } from "@/components/edit-student-profile-dialog"
import { currentStudent, experienceItems } from "@/lib/data"

export function StudentProfileCard() {
  const [experience, setExperience] = useState(experienceItems)

  function removeItem(id: string) {
    setExperience((items) => items.filter((item) => item.id !== id))
  }

  return (
    <div className="space-y-4">
      <Alert className="border-border bg-muted">
        <ShieldCheck className="size-4 text-foreground" />
        <AlertDescription className="text-foreground">
          This base profile is automatically attached to all your applications. You only need to type this once.
        </AlertDescription>
      </Alert>

      <Card className="overflow-hidden">
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="group relative">
              <Avatar className="size-18 border-4 border-card shadow-none">
                <AvatarFallback className="bg-secondary text-lg font-semibold text-foreground">
                  {currentStudent.initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                aria-label="Upload profile photo"
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Camera className="size-4" />
              </button>
            </div>

            <div className="min-w-0 flex-1 space-y-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{currentStudent.name}</h2>
                <Badge variant="secondary" className="gap-1 font-normal">
                  <GraduationCap className="size-3" />
                  {currentStudent.classYear}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{currentStudent.major}</p>
              <Badge variant="outline" className="gap-1.5 font-normal text-success">
                <ShieldCheck className="size-3.5" />
                {currentStudent.computingId}@virginia.edu
              </Badge>
            </div>

            <EditStudentProfileDialog />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="major" className="text-xs text-muted-foreground">
                Major
              </Label>
              <Input id="major" defaultValue={currentStudent.major} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="linkedin" className="text-xs text-muted-foreground">
                LinkedIn URL
              </Label>
              <div className="relative">
                <Linkedin className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="linkedin" defaultValue={currentStudent.linkedin} className="pl-8 text-sm" />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight">Experience & Accolades</h3>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                <Plus className="size-3.5" />
                Add item
              </Button>
            </div>

            <div className="space-y-2">
              {experience.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.subtitle} · {item.period}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${item.title}`}
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              {experience.length === 0 && (
                <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                  No items yet — add your first experience or accolade.
                </p>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold tracking-tight">Resume</h3>
            <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/30 px-3 py-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
                <FileText className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{currentStudent.resumeFileName}</p>
                <p className="text-xs text-muted-foreground">Attached to every application</p>
              </div>
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs">
                <Upload className="size-3.5" />
                Replace
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
