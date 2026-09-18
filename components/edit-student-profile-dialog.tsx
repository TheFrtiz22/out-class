"use client"

import { useState } from "react"
import { Camera, Linkedin, FileText, Trash2, Upload } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const orangeFocus =
  "border-gray-300 focus-visible:border-[#FF5900] focus-visible:ring-[#FF5900]/30"

export function EditStudentProfileDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [resumeFile, setResumeFile] = useState<string | null>("Resume_Fall2026.pdf")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="border-gray-300 bg-white text-[#051B3D] hover:bg-gray-50">
            Edit Profile
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden bg-white p-0 sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 border-b border-gray-200 px-6 py-4">
          <DialogTitle className="text-lg font-bold text-[#051B3D]">Edit Student Profile</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-white px-6 py-6">
          <div className="space-y-8">
            {/* Section 1 — Core Identity */}
            <section className="space-y-5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#051B3D]">Core Identity</h3>

              <div className="flex items-center gap-5">
                <div className="relative">
                  <Avatar className="size-24 border-4 border-white shadow-none">
                    <AvatarFallback className="bg-[#051B3D] text-2xl font-semibold text-white">JK</AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    aria-label="Upload photo"
                    className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border-2 border-white bg-[#FF5900] text-white shadow-none transition-colors hover:bg-[#e65000]"
                  >
                    <Camera className="size-4" />
                  </button>
                </div>
                <div className="text-sm text-gray-500">
                  <p className="font-medium text-[#051B3D]">Profile Picture</p>
                  <p>JPG or PNG, up to 5MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="first-name" className="text-xs text-gray-500">
                    First Name
                  </Label>
                  <Input id="first-name" defaultValue="Jesse" className={orangeFocus} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last-name" className="text-xs text-gray-500">
                    Last Name
                  </Label>
                  <Input id="last-name" defaultValue="Klinger" className={orangeFocus} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs text-gray-500">
                  Computing ID
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    disabled
                    defaultValue="jkl2030"
                    className="bg-gray-100 pr-28 text-gray-500"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    @virginia.edu
                  </span>
                </div>
              </div>
            </section>

            <hr className="border-gray-200" />

            {/* Section 2 — Academics & Stats */}
            <section className="space-y-5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#051B3D]">Academics &amp; Stats</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="class-year" className="text-xs text-gray-500">
                    Class Year
                  </Label>
                  <Select defaultValue="2030">
                    <SelectTrigger id="class-year" className={`w-full ${orangeFocus}`}>
                      <SelectValue placeholder="Select class year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2027">Class of 2027</SelectItem>
                      <SelectItem value="2028">Class of 2028</SelectItem>
                      <SelectItem value="2029">Class of 2029</SelectItem>
                      <SelectItem value="2030">Class of 2030</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="major" className="text-xs text-gray-500">
                    Major / Intended Major
                  </Label>
                  <Input id="major" defaultValue="Finance" className={orangeFocus} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gpa" className="text-xs text-gray-500">
                    Cumulative GPA
                  </Label>
                  <Input id="gpa" type="number" step="0.01" min={0} max={4} defaultValue="3.9" className={orangeFocus} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sat" className="text-xs text-gray-500">
                    SAT Score (Out of 1600)
                  </Label>
                  <Input id="sat" type="number" min={400} max={1600} defaultValue="1500" className={orangeFocus} />
                </div>
              </div>
              <p className="text-xs italic text-gray-400">
                Scores are only shared with clubs that explicitly require them.
              </p>
            </section>

            <hr className="border-gray-200" />

            {/* Section 3 — Professional Details */}
            <section className="space-y-5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#051B3D]">Professional Details</h3>

              <div className="space-y-1.5">
                <Label htmlFor="linkedin" className="text-xs text-gray-500">
                  LinkedIn Profile
                </Label>
                <div className="relative">
                  <Linkedin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="linkedin"
                    defaultValue="linkedin.com/in/jesseklinger"
                    className={`pl-9 ${orangeFocus}`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">Master Resume</Label>
                {resumeFile ? (
                  <div className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#051B3D]/10 text-[#051B3D]">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#051B3D]">{resumeFile}</p>
                      <p className="text-xs text-gray-500">Attached to every application</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5 border-gray-300 text-xs text-[#051B3D] hover:bg-gray-50"
                    >
                      <Upload className="size-3.5" />
                      Replace
                    </Button>
                    <button
                      type="button"
                      aria-label="Remove resume"
                      onClick={() => setResumeFile(null)}
                      className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-6 text-center hover:border-[#FF5900]/50">
                    <Upload className="size-5 text-gray-400" />
                    <span className="text-sm font-medium text-[#051B3D]">Upload resume</span>
                    <span className="text-xs text-gray-500">PDF, up to 10MB</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      onChange={(e) => setResumeFile(e.target.files?.[0]?.name ?? null)}
                    />
                  </label>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-gray-200 bg-white px-6 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            className="text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => setOpen(false)}
            className="bg-[#FF5900] text-white hover:bg-[#e65000]"
          >
            Save Base Profile
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
