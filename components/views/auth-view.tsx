"use client"

import { useState } from "react"
import { ArrowRight, Check, GraduationCap, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OutClassLogo } from "@/components/outclass-logo"
import type { ViewId } from "@/lib/views"

const FEATURE_BULLETS = ["Ditch the Google Forms", "Track every round", "Verified student network"]

export function AuthView({ onEnter }: { onEnter: (view: ViewId) => void }) {
  const [role, setRole] = useState<"student" | "leader">("student")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onEnter(role === "student" ? "student-dashboard" : "leader-dashboard")
  }

  return (
    <div className="grid min-h-svh overflow-hidden md:grid-cols-2">
      {/* Left — the pitch (dark theme) */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-[#051B3D] px-8 py-10 sm:px-12 sm:py-12 md:min-h-svh">
        {/* Subtle navy gradient depth */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background: "radial-gradient(75% 60% at 20% 10%, rgba(255,89,0,0.10), transparent)",
          }}
        />

        <div className="relative">
          <OutClassLogo variant="dark" className="h-9 w-auto" />
        </div>

        <div className="relative">
          <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
            One profile. Every selective club.
          </h1>
          <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-[#94A3B8]">
            The centralized recruitment pipeline built specifically for selective college clubs.
          </p>

          <ul className="mt-8 space-y-3">
            {FEATURE_BULLETS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-white/80">
                <span className="mt-0.5 flex size-5 flex-none items-center justify-center rounded-full bg-[#FF5900]/15">
                  <Check className="size-3.5 text-[#FF5900]" strokeWidth={3} />
                </span>
                <span className="text-pretty leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">Built for selective clubs at the University of Virginia.</p>
      </div>

      {/* Right — the login gateway (light theme) */}
      <div className="flex items-center justify-center bg-white px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 md:hidden">
            <OutClassLogo variant="light" className="h-8 w-auto" />
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-[#051B3D]">Welcome back</h2>
          <p className="mt-1.5 text-sm text-slate-500">Sign in with your UVA email to continue.</p>

          <Tabs value={role} onValueChange={(v) => setRole(v as "student" | "leader")} className="mt-8">
            <TabsList className="grid w-full grid-cols-2 rounded-none border-b border-slate-200 bg-transparent p-0">
              <TabsTrigger
                value="student"
                className="rounded-none border-b-2 border-transparent bg-transparent px-2 pb-3 text-sm font-medium text-slate-500 shadow-none data-[state=active]:border-[#FF5900] data-[state=active]:bg-transparent data-[state=active]:text-[#051B3D] data-[state=active]:shadow-none"
              >
                <GraduationCap className="size-4" />
                Student Login
              </TabsTrigger>
              <TabsTrigger
                value="leader"
                className="rounded-none border-b-2 border-transparent bg-transparent px-2 pb-3 text-sm font-medium text-slate-500 shadow-none data-[state=active]:border-[#FF5900] data-[state=active]:bg-transparent data-[state=active]:text-[#051B3D] data-[state=active]:shadow-none"
              >
                <ShieldCheck className="size-4" />
                Club Leader Login
              </TabsTrigger>
            </TabsList>

            <TabsContent value="student" className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="student-email" className="text-[#051B3D]">
                    Email
                  </Label>
                  <Input
                    id="student-email"
                    type="email"
                    required
                    placeholder="computingID@virginia.edu"
                    defaultValue="jav4bt@virginia.edu"
                    className="border-slate-200 focus-visible:border-[#FF5900] focus-visible:ring-[#FF5900]/40"
                  />
                  <p className="text-xs text-slate-500">Access requires a verified @virginia.edu address.</p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="student-password" className="text-[#051B3D]">
                      Password
                    </Label>
                    <button type="button" className="text-xs font-medium text-slate-500 hover:text-[#FF5900]">
                      Forgot?
                    </button>
                  </div>
                  <Input
                    id="student-password"
                    type="password"
                    required
                    defaultValue="demo-password"
                    className="border-slate-200 focus-visible:border-[#FF5900] focus-visible:ring-[#FF5900]/40"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#FF5900] text-white hover:bg-[#051B3D]"
                >
                  Sign In
                  <ArrowRight className="size-4" />
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="leader" className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="leader-email" className="text-[#051B3D]">
                    Email
                  </Label>
                  <Input
                    id="leader-email"
                    type="email"
                    required
                    placeholder="computingID@virginia.edu"
                    defaultValue="pn8xk@virginia.edu"
                    className="border-slate-200 focus-visible:border-[#FF5900] focus-visible:ring-[#FF5900]/40"
                  />
                  <p className="text-xs text-slate-500">Access requires a verified @virginia.edu address.</p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="leader-password" className="text-[#051B3D]">
                      Password
                    </Label>
                    <button type="button" className="text-xs font-medium text-slate-500 hover:text-[#FF5900]">
                      Forgot?
                    </button>
                  </div>
                  <Input
                    id="leader-password"
                    type="password"
                    required
                    defaultValue="demo-password"
                    className="border-slate-200 focus-visible:border-[#FF5900] focus-visible:ring-[#FF5900]/40"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#FF5900] text-white hover:bg-[#051B3D]"
                >
                  Sign In
                  <ArrowRight className="size-4" />
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <p className="mt-8 text-center text-sm text-slate-500">
            New here?{" "}
            <button type="button" className="font-medium text-[#FF5900] hover:underline">
              Create your OutClass profile
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
